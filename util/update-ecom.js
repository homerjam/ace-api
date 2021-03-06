const _ = require('lodash');
const Promise = require('bluebird');
const Cloudant = require('@cloudant/cloudant');

const BATCH_UPDATE_CHUNK_SIZE = 100;

const args = process.argv.slice(2);

if (!args[1]) {
  throw Error('No db specified');
}

const docFilter = doc => doc.type && /order|customer/.test(doc.type);

const docMutate = (doc) => {
  if (!doc.modifiedAt) {
    doc.modifiedAt = doc.modified;
    delete doc.modified;
  }

  if (!doc.createdAt) {
    doc.createdAt = doc.created;
    delete doc.created;
  }

  return doc;
};

const batchUpdateDocs = (db, docs) => Promise.all(_.chunk(docs, BATCH_UPDATE_CHUNK_SIZE).map(chunk => db.bulk({ docs: chunk })));

args.forEach(async (dbName) => {
  const db = new Cloudant({
    url: args[0],
    plugins: ['promises', 'retry'],
  }).db.use(dbName);

  let docs = (await db.list({ include_docs: true })).rows.map(row => row.doc);

  docs = docs.filter(docFilter);

  docs = docs.map(docMutate);

  await batchUpdateDocs(db, docs);

  console.log(`${dbName} --> ${docs.length} orders/customers updated`);
});
