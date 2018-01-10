const _ = require('lodash');
const Promise = require('bluebird');
const Cloudant = require('cloudant');

const BATCH_UPDATE_CHUNK_SIZE = 100;

const args = process.argv.slice(2);

if (!args[1]) {
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

const batchUpdateDocs = (db, docs) => Promise.all(_.chunk(docs, BATCH_UPDATE_CHUNK_SIZE).map(chunk => db.bulk({ docs: chunk })));

args.forEach(async (dbName) => {
  const db = new Cloudant({
    url: args[0],
    plugins: ['promises', 'retry429'],
  }).db.use(dbName);

  let docs = (await db.list({ include_docs: true })).rows.map(row => row.doc);

  docs = docs.filter(docFilter);

  docs = docs.map(docMutate);

  const result = await batchUpdateDocs(db, docs);

  console.log(`${dbName} --> ${docs.length} files updated`);
});
