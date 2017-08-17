const _ = require('lodash');
const Promise = require('bluebird');
const Cloudant = require('cloudant');

const BATCH_UPDATE_CHUNK_SIZE = 100;

const args = process.argv.slice(2);

if (!args[0]) {
  throw Error('No db specified');
}

const docFilter = doc => doc.type && doc.type === 'file';

const docMutate = (doc) => {
  if (!doc.uploadedAt) {
    doc.uploadedAt = doc.uploaded;
    delete doc.uploaded;
  }

  return doc;
};

const batchUpdateDocs = (db, docs) => Promise.all(_.chunk(docs, BATCH_UPDATE_CHUNK_SIZE).map(chunk => db.bulkAsync({ docs: chunk })));

args.forEach(async (dbName) => {
  const db = Promise.promisifyAll(Cloudant({
    url: process.env.DB_URL,
  }).db.use(dbName));

  let docs = (await db.listAsync({ include_docs: true })).rows.map(row => row.doc);

  docs = docs.filter(docFilter);

  docs = docs.map(docMutate);

  const result = await batchUpdateDocs(db, docs);

  console.log(`${dbName} --> ${docs.length} entities updated`);
});