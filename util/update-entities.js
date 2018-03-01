const _ = require('lodash');
const Promise = require('bluebird');
const Cloudant = require('@cloudant/cloudant');

process.on('unhandledRejection', result => console.error(result));

const BATCH_UPDATE_CHUNK_SIZE = 100;

const args = process.argv.slice(2);

if (!args[1]) {
  throw Error('No db specified');
}

const docFilter = doc => doc.type && doc.type === 'entity';

const updateThumbnail = (doc) => {
  if (!_.isObject(doc)) {
    return doc;
  }

  if (doc.thumbnail && doc.thumbnail.thumbnailUrl && /_thumb_0000/.test(doc.thumbnail.thumbnailUrl)) {
    doc.thumbnail.fileName = `${doc.thumbnail.thumbnailUrl.split('/').slice(-2)[0]}.mp4`;
    doc.thumbnail.duration = 0;
  }

  if (doc.thumbnail && doc.thumbnail.thumbnailUrl) {
    doc.thumbnail.thumbnailUrl = doc.thumbnail.thumbnailUrl
      .replace('https://fokusio.s3.amazonaws.com', 'https://assist.cdn.fokus.io')
      .replace('_thumb_0000.jpg', 'thumb.jpg');
  }

  if (doc.thumbnail && doc.thumbnail.fileName) {
    doc.thumbnail.name = doc.thumbnail.fileName.split('.')[0];
    doc.thumbnail.ext = `.${doc.thumbnail.fileName.split('.')[1]}`;
  }

  if (doc.thumbnail) {
    delete doc.thumbnail.mimeType;
    delete doc.thumbnail.location;
  }

  return doc;
};

const docMutate = (doc) => {
  doc.fields = _.mapValues(doc.fields, (field) => {

    try {
      if (field.value && field.value.type === 'file') {
        const _field = _.cloneDeep(field.value);

        field.value = {
          original: {
            fileName: _field.fileName || _field.original.fileName,
            fileSize: _field.fileSize || _field.original.fileSize,
            mimeType: _field.mimeType || _field.original.mimeType,
          },

          metadata: {
            width: _field.metadata.width || _field.metadata.zencoder.thumbnail.width,
            height: _field.metadata.height || _field.metadata.zencoder.thumbnail.height,
            format: (_field.mimeType || _field.original.mimeType).split('/')[1],
          },

          crops: _field.crops || undefined,
          dzi: _field.dzi || undefined,
        };

        if (_field.location === 's3') {
          field.value.file = {
            name: _field.metadata.s3.base,
            ext: _field.metadata.s3.ext,
            size: _field.original.fileSize,
          };
        }

        if (_field.location === 'assist') {
          field.value.file = {
            name: _field.fileName.split('.')[0],
            ext: `.${_field.fileName.split('.')[1]}`,
            size: _field.fileSize,
          };
        }

        if (_field.metadata.zencoder) {
          field.value.metadata.duration = _.sample(_field.metadata.zencoder.outputs).duration;
        }
      }
    } catch (error) {
      console.error('ERROR --> ');
      console.error(field);
      console.error(error);
      field.value = undefined;
    }

    if (_.isArray(field.value)) {
      field.value = field.value.map(updateThumbnail);
    }

    return field;
  });

  doc = updateThumbnail(doc);

  return doc;
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

  console.log(`${dbName} --> ${docs.length} entities found`);

  docs = docs.map(docMutate);

  await batchUpdateDocs(db, docs);

  console.log(`${dbName} --> ${docs.length} entities updated`);
});
