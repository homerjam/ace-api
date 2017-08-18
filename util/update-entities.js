const _ = require('lodash');
const Promise = require('bluebird');
const Cloudant = require('cloudant');

const BATCH_UPDATE_CHUNK_SIZE = 100;

const args = process.argv.slice(2);

if (!args[1]) {
  throw Error('No db specified');
}

const docFilter = doc => doc.type && doc.type === 'entity';

const docMutate = (doc) => {
  if (!doc.modifiedAt) {
    doc.modifiedAt = doc.modified;
    delete doc.modified;
  }

  if (!doc.createdAt) {
    doc.createdAt = doc.created;
    delete doc.created;
  }

  doc.fields = _.mapValues(doc.fields, (field) => {
    if (field.fieldType) {
      field.type = field.fieldType;
      // delete field.fieldType; // TODO: remove fieldType
    }

    if (field.value && _.isObject(field.value.taxonomy)) {
      field.value.taxonomy = field.value.taxonomy.slug;
    }

    return field;
  });

  return doc;
};

const batchUpdateDocs = (db, docs) => Promise.all(_.chunk(docs, BATCH_UPDATE_CHUNK_SIZE).map(chunk => db.bulkAsync({ docs: chunk })));

args.forEach(async (dbName) => {
  const db = Promise.promisifyAll(Cloudant({
    url: args[0],
  }).db.use(dbName));

  let docs = (await db.listAsync({ include_docs: true })).rows.map(row => row.doc);

  docs = docs.filter(docFilter);

  docs = docs.map(docMutate);

  const result = await batchUpdateDocs(db, docs);

  console.log(`${dbName} --> ${docs.length} entities updated`);
});
