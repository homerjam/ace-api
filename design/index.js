var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var request = require('request-promise');

var args = process.argv.slice(2);

if (args.length < 1) {
  console.error('Usage: [url] db(s) [doc]');
  process.exit(1);
}

var DB_URL = args.length === 3 ? args[0] : process.env.DB_URL;
var DB_NAME = args.length === 3 ? args[1] : args[0];
var DOC = args.length === 3 ? args[2] : args[1];

var COMMENT_PATTERN = new RegExp('(\\/\\*([^*]|[\\r\\n]|(\\*+([^*/]|[\\r\\n])))*\\*+/)|(//.*)', 'g');

function prepareFn (fn) {
  fn = fn.toString();
  fn = fn.replace(COMMENT_PATTERN, '');
  fn = 'function ' + fn.slice(fn.indexOf('(')).replace(/\t|\n/g, '');
  return fn;
}

function prepareDoc (x) {
  for (var i in x) {
    if (i[0] !== '_') {
      if (typeof x[i] === 'function') {
        x[i] = prepareFn(x[i]);
      } else if (toString.call(x[i]) === '[object Array]') {
        x[i] = 'exports.' + x[i][0] + ' = ' + prepareFn(x[i][1]);
      } else if (typeof x[i] === 'object') {
        prepareDoc(x[i]);
      }
    }
  }
}

function getDirs (srcpath) {
  return fs.readdirSync(srcpath).filter(function (file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
}

var docMap = {};

var docs = getDirs(path.resolve(__dirname));

docs.forEach(function (docName) {
  if (DOC && DOC !== docName) {
    return;
  }

  var dDoc = require(path.resolve(__dirname, docName));

  prepareDoc(dDoc);

  var dbs = DB_NAME.split(',');

  dbs.forEach(function(dbName) {
    var uri = [DB_URL, dbName, '_design', docName].join('/');

    docMap[uri] = _.cloneDeep(dDoc);

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

        dDoc = JSON.stringify(dDoc);

        request({
          method: 'PUT',
          uri: response.request.uri.href,
          headers: {
            'Content-Type': 'application/json',
          },
          body: dDoc,
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
