process.on('unhandledRejection', rejection => console.error(rejection));

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var request = require('request-promise');

var args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: url [doc] db1[,db2,db3...]');
  process.exit(0);
}

var DB_URL = args[0];
var DB_NAME = args.length === 3 ? args[2] : args[1];
var DOC_NAME = args.length === 3 ? args[1] : undefined;

var COMMENT_PATTERN = new RegExp('(\\/\\*([^*]|[\\r\\n]|(\\*+([^*/]|[\\r\\n])))*\\*+/)|(//.*)', 'g');

var docMap = {};

function prepareFn (fn) {
  fn = fn.toString();
  fn = fn.replace(COMMENT_PATTERN, '');
  fn = 'function ' + fn.slice(fn.indexOf('(')).replace(/\t|\n/g, '');
  return fn;
}

function prepareDesignDoc (x) {
  for (var i in x) {
    if (i[0] !== '_') {
      if (typeof x[i] === 'function') {
        x[i] = prepareFn(x[i]);
      } else if (toString.call(x[i]) === '[object Array]') {
        x[i] = 'exports.' + x[i][0] + ' = ' + prepareFn(x[i][1]);
      } else if (typeof x[i] === 'object') {
        prepareDesignDoc(x[i]);
      }
    }
  }
}

function getDirs (srcpath) {
  return fs.readdirSync(srcpath).filter(function (file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
}

function deleteOldDesignDocs (newDesignDocs, dbName) {
  request({
    method: 'GET',
    uri: [DB_URL, dbName, '_all_docs?startkey="_design"&endkey="_design0"&include_docs=true'].join('/'),
    simple: false,
    resolveWithFullResponse: true,
  })
    .then(function (response) {
      var oldDocs = JSON.parse(response.body).rows.map(function(row) {
        return row.doc;
      });

      oldDocs = oldDocs.filter(function (oldDoc) {
        return newDesignDocs.indexOf(oldDoc._id.replace('_design/', '')) === -1;
      });

      if (!oldDocs.length) {
        return;
      }

      oldDocs = oldDocs.map(oldDoc => ({
        _id: oldDoc._id,
        _rev: oldDoc._rev,
        _deleted: true,
      }));

      request({
        method: 'POST',
        uri: [DB_URL, dbName, '_bulk_docs'].join('/'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          docs: oldDocs,
        }),
        simple: false,
        resolveWithFullResponse: true,
      })
        .then(function (response) {
          console.log(dbName, 'deleted', oldDocs.map(function (oldDoc) { return oldDoc._id; }).join(', '));
        });
    });
}

function init() {
  var newDesignDocs = getDirs(path.resolve(__dirname));

  var dbs = DB_NAME.split(',');

  dbs.forEach(function(dbName) {
    deleteOldDesignDocs(newDesignDocs, dbName);
  });

  newDesignDocs.forEach(function (designDocName) {
    if (DOC_NAME && DOC_NAME !== designDocName) {
      return;
    }

    var designDoc = require(path.resolve(__dirname, designDocName));

    prepareDesignDoc(designDoc);

    dbs.forEach(function(dbName) {

      var uri = [DB_URL, dbName, '_design', designDocName].join('/');

      docMap[uri] = _.cloneDeep(designDoc);

      request({
        method: 'GET',
        uri: uri,
        simple: false,
        resolveWithFullResponse: true,
      })
        .then(function (response) {
          var uri = response.request.uri.href;
          var dDoc = docMap[uri];

          if (response.statusCode === 200) {
            dDoc._rev = JSON.parse(response.body)._rev;
          }

          request({
            method: 'PUT',
            uri: response.request.uri.href,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(dDoc),
            simple: true,
            resolveWithFullResponse: true,
          })
            .then(function (response) {
              console.log('%d %s', response.statusCode, response.request.uri.path);
            }, function (error) {
              console.error('%d %s', error.statusCode, error.response.request.uri.path);
              process.exit(1);
            });
        }, function (error) {
          console.error(error.error);
          process.exit(1);
        });
    });
  });
}

init();
