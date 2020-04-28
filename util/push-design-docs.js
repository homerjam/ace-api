process.on('unhandledRejection', (rejection) => console.error(rejection));

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const Stagger = require('stagger');
const got = require('got');

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

const dbUrl = new URL(DB_URL);

const dbGot = got.extend({
  prefixUrl: dbUrl.origin,
  username: dbUrl.username,
  password: dbUrl.password,
  responseType: 'json',
});

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
    .filter((file) => fs.statSync(path.join(srcpath, file)).isDirectory());
}

async function deleteOldDesignDocs(newDesignDocs, dbName) {
  const { body: result } = await dbGot([dbName, '_all_docs'].join('/'), {
    searchParams: {
      startkey: '"_design"',
      endkey: '"_design0"',
      include_docs: true,
    },
  });

  if (result.error) {
    console.error(dbName, result.error);
    process.exit(0);
  }

  let oldDocs = result.rows.map(({ doc }) => doc);

  oldDocs = oldDocs.filter(
    ({ _id }) => !newDesignDocs.includes(_id.replace('_design/', ''))
  );

  if (!oldDocs.length) {
    return;
  }

  oldDocs = oldDocs.map(({ _id, _rev }) => ({
    _id: _id,
    _rev: _rev,
    _deleted: true,
  }));

  await dbGot([dbName, '_bulk_docs'].join('/'), {
    headers: {
      'Content-Type': 'application/json',
    },
    json: {
      docs: oldDocs,
    },
  });

  console.log(dbName, 'deleted', oldDocs.map(({ _id }) => _id).join(', '));
}

async function createNewDesignDocs(dbName, designDocName, designDoc) {
  const url = [dbName, '_design', designDocName].join('/');

  docMap[url] = _.cloneDeep(designDoc);

  const { statusCode, body: result } = await dbGot(url, {
    throwHttpErrors: false,
  });

  if (result.error && result.error !== 'not_found') {
    console.error(dbName, result.error);
    process.exit(0);
  }

  const dDoc = docMap[url];

  if (statusCode === 200) {
    dDoc._rev = result._rev;
  }

  try {
    const { statusCode } = await dbGot.put(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      json: dDoc,
    });

    console.log('%d %s', statusCode, url);
  } catch (error) {
    console.error('%d %s', error.response.statusCode, url);
    process.exit(1);
  }
}

function init() {
  const newDesignDocs = getDirs(path.resolve(__dirname, '../design'));

  const dbs = DB_NAME.split(',');

  const part1 = new Stagger({
    requestsPerSecond: 2,
  });

  dbs.forEach((dbName) => {
    part1.push(async (cb) => {
      await deleteOldDesignDocs(newDesignDocs, dbName);
      cb();
    });
  });

  part1.on('finish', () => {
    const part2 = new Stagger({
      requestsPerSecond: 2,
    });

    newDesignDocs.forEach((designDocName) => {
      if (DOC_NAME && DOC_NAME !== designDocName) {
        return;
      }

      const designDoc = require(path.resolve(
        __dirname,
        '../design',
        designDocName
      ));

      prepareDesignDoc(designDoc);

      dbs.forEach((dbName) => {
        part2.push(async (cb) => {
          await createNewDesignDocs(dbName, designDocName, designDoc);
          cb();
        });
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
