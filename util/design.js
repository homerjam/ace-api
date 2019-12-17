process.on('unhandledRejection', rejection => console.error(rejection));

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const Stagger = require('stagger');
const request = require('request-promise');

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: url [doc] db1[,db2,db3...]');
  process.exit(0);
}

const DB_URL = args[0];
const DB_NAME = args.length === 3 ? args[2] : args[1];
const DOC_NAME = args.length === 3 ? args[1] : undefined;

const COMMENT_PATTERN = new RegExp(
  '(\\/\\*([^*]|[\\r\\n]|(\\*+([^*/]|[\\r\\n])))*\\*+/)|(//.*)',
  'g'
);

const docMap = {};

function prepareFn(fn) {
  fn = fn.toString();
  fn = fn.replace(COMMENT_PATTERN, '');
  fn = `function ${fn.slice(fn.indexOf('(')).replace(/\t|\n/g, '')}`;
  return fn;
}

function prepareDesignDoc(x) {
  for (const i in x) {
    if (i[0] !== '_') {
      if (typeof x[i] === 'function') {
        x[i] = prepareFn(x[i]);
      } else if (toString.call(x[i]) === '[object Array]') {
        x[i] = `exports.${x[i][0]} = ${prepareFn(x[i][1])}`;
      } else if (typeof x[i] === 'object') {
        prepareDesignDoc(x[i]);
      }
    }
  }
}

function getDirs(srcpath) {
  return fs
    .readdirSync(srcpath)
    .filter(file => fs.statSync(path.join(srcpath, file)).isDirectory());
}

function deleteOldDesignDocs(newDesignDocs, dbName) {
  return cb => {
    request({
      method: 'GET',
      uri: [
        DB_URL,
        dbName,
        '_all_docs?startkey="_design"&endkey="_design0"&include_docs=true',
      ].join('/'),
      simple: false,
      resolveWithFullResponse: true,
    }).then(
      ({ body }) => {
        const result = JSON.parse(body);

        if (result.error) {
          console.error(dbName, result.error);
          process.exit(0);
        }

        let oldDocs = result.rows.map(({ doc }) => doc);

        oldDocs = oldDocs.filter(
          ({ _id }) => !newDesignDocs.includes(_id.replace('_design/', ''))
        );

        if (!oldDocs.length) {
          cb();
          return;
        }

        oldDocs = oldDocs.map(({ _id, _rev }) => ({
          _id: _id,
          _rev: _rev,
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
        }).then(
          () => {
            console.log(
              dbName,
              'deleted',
              oldDocs.map(({ _id }) => _id).join(', ')
            );

            cb();
          },
          error => {
            console.error(error.error);
            process.exit(1);
          }
        );
      },
      error => {
        console.error(error.error);
        process.exit(1);
      }
    );
  };
}

function createNewDesignDocs(dbName, designDocName, designDoc) {
  return cb => {
    const uri = [DB_URL, dbName, '_design', designDocName].join('/');

    docMap[uri] = _.cloneDeep(designDoc);

    request({
      method: 'GET',
      uri,
      simple: false,
      resolveWithFullResponse: true,
    }).then(
      response => {
        const result = JSON.parse(response.body);

        if (result.error && result.error !== 'not_found') {
          console.error(dbName, result.error);
          process.exit(0);
        }

        const uri = response.request.uri.href;
        const dDoc = docMap[uri];

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
        }).then(
          response => {
            const result = JSON.parse(response.body);

            if (result.error) {
              console.error(dbName, result.error);
              process.exit(0);
            }

            console.log(
              '%d %s',
              response.statusCode,
              response.request.uri.path
            );

            cb();
          },
          error => {
            console.error(
              '%d %s',
              error.statusCode,
              error.response.request.uri.path
            );
            process.exit(1);
          }
        );
      },
      error => {
        console.error(error.error);
        process.exit(1);
      }
    );
  };
}

function init() {
  const newDesignDocs = getDirs(path.resolve(__dirname, '../design'));

  const dbs = DB_NAME.split(',');

  const part1 = new Stagger({
    requestsPerSecond: 2,
  });

  dbs.forEach(dbName => {
    part1.push(deleteOldDesignDocs(newDesignDocs, dbName));
  });

  part1.on('finish', () => {
    const part2 = new Stagger({
      requestsPerSecond: 2,
    });

    newDesignDocs.forEach(designDocName => {
      if (DOC_NAME && DOC_NAME !== designDocName) {
        return;
      }

      const designDoc = require(path.resolve(
        __dirname,
        '../design',
        designDocName
      ));

      prepareDesignDoc(designDoc);

      dbs.forEach(dbName => {
        part2.push(createNewDesignDocs(dbName, designDocName, designDoc));
      });
    });

    part2.on('finish', () => {
      console.log('finished');
    });

    part2.start();
  });

  part1.start();
}

init();
