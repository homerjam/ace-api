var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var env = require('node-env-file');
var request = require('request-promise');

env('.env');

var databases = [{
  name: process.env.AUTH_DB_NAME,
  designDocsFolder: 'auth',
}];

process.env.AGENT_DB_NAME.split(',').forEach(function (dbName) {
  databases.push({
    name: dbName,
    designDocsFolder: 'agent',
  });
});

var args = process.argv.slice(2);

if (args.length === 0) {
  throw new Error('auth/agent not specified');
}

var commentPattern = new RegExp('(\\/\\*([^*]|[\\r\\n]|(\\*+([^*\/]|[\\r\\n])))*\\*+\/)|(\/\/.*)', 'g');

var prepareFn = function (fn) {
  fn = fn.toString();
  fn = fn.replace(commentPattern, '');
  fn = 'function ' + fn.slice(fn.indexOf('(')).replace(/\t|\n/g, '');
  return fn;
};

var preparedesignDoc = function (x) {
  for (var i in x) {
    if (i[0] !== '_') {
      if (typeof x[i] === 'function') {
        x[i] = prepareFn(x[i]);

      } else if (toString.call(x[i]) === '[object Array]') {
        x[i] = 'exports.' + x[i][0] + ' = ' + prepareFn(x[i][1]);

      } else if (typeof x[i] === 'object') {
        preparedesignDoc(x[i]);
      }
    }
  }
};

var designDocMap = {};

databases.forEach(function (db) {
  if (args[0] !== db.designDocsFolder) {
    return;
  }

  var designDocs = fs.readdirSync(path.join(__dirname, db.designDocsFolder));

  designDocs = designDocs.filter(function (designDocName) {
    return !/\.DS_Store/.test(designDocName);
  });

  designDocs.forEach(function (designDocName) {
    designDocName = designDocName.replace(/.js/, '');

    var uri = [process.env.DB_URL, db.name, '_design', designDocName].join('/');
    var designDoc = require('./' + [db.designDocsFolder, designDocName].join('/'));

    if (args.length > 1 && args.indexOf(designDocName) === -1) {
      return;
    }

    preparedesignDoc(designDoc);

    designDocMap[uri] = _.cloneDeep(designDoc);

    request({
      method: 'GET',
      uri: uri,
      simple: false,
      resolveWithFullResponse: true,
    })
      .then(function (response) {
        var uri = response.request.uri.href;
        var designDoc = designDocMap[uri];

        if (response.statusCode === 200) {
          designDoc._rev = JSON.parse(response.body)._rev;
        }

        designDoc = JSON.stringify(designDoc);

        request({
          method: 'PUT',
          uri: response.request.uri.href,
          headers: {
            'Content-Type': 'application/json',
          },
          body: designDoc,
          simple: true,
          resolveWithFullResponse: true,
        })
          .then(function (response) {
            console.log('%d %s', response.statusCode, response.request.uri.path);

          }, function (error) {
            console.error('%d %s', error.statusCode, error.response.request.uri.path);
          });

      }, function (error) {
        console.error(error.error);
      });

  });

});
