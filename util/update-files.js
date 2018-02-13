process.on('unhandledRejection', rejection => console.error(rejection));

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

const dbUrl = args[0];
const dbNames = args.slice(1);

dbNames.forEach((dbName) => {
  const db = new Cloudant({
    url: dbUrl,
    plugins: ['promises', 'retry'],
  }).db.use(dbName);

  const response = db.list({ include_docs: true });

  let body = '';

  response.on('data', (chunk) => {
    body += chunk;
  });

  response.on('end', async () => {
    let docs = JSON.parse(body).rows.map(row => row.doc);

    docs = docs.filter(docFilter);

    docs = docs.map(docMutate);

    await batchUpdateDocs(db, docs);

    console.log(`${dbName} --> ${docs.length} files updated`);
  });
});
