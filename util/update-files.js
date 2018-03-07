process.on('unhandledRejection', rejection => console.error(rejection));

const _ = require('lodash');
const Promise = require('bluebird');
const Cloudant = require('@cloudant/cloudant');

const BATCH_UPDATE_CHUNK_SIZE = 1000;

const args = process.argv.slice(2);

if (!args[1]) {
  throw Error('No db specified');
}

const docFilter = doc => doc.type && doc.type === 'file';

const docMutate = (doc) => {
  return {
    _id: doc._id,
    _rev: doc._rev,
    _deleted: true,
  };
};

const batchUpdateDocs = (db, docs) => Promise.all(_.chunk(docs, BATCH_UPDATE_CHUNK_SIZE).map(chunk => db.bulk({ docs: chunk })));

const dbUrl = args[0];
const dbNames = args.slice(1);

dbNames.forEach(async (dbName) => {
  const db = new Cloudant({
    url: dbUrl,
    plugins: ['promises', 'retry'],
  }).db.use(dbName);

  let docs = (await db.list({ include_docs: true })).rows.map(row => row.doc);

  console.log(`${dbName} --> ${docs.length} docs fetched`);

  docs = docs.filter(docFilter);

  console.log(`${dbName} --> ${docs.length} files found`);

  docs = docs.map(docMutate);

  await batchUpdateDocs(db, docs);

  console.log(`${dbName} --> ${docs.length} files updated`);
});

