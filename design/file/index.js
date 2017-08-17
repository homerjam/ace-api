var ddoc = {
  _id: '_design/file',
  views: {
    trashed: {
      map: function (doc) {
        if (doc.type === 'file' && !doc.entity) {
          emit(doc._id, null);
        }
      },
    },
  },
  indexes: {
    all: {
      index: function (doc) {
        if (doc.type === 'file') {
          index('trashed', !doc.entity, {
            store: true,
            index: 'not_analyzed',
          });

          index('uploadedAt', doc.uploadedAt, {
            store: true,
            index: 'not_analyzed',
          });

          index('sort.uploadedAt', new Date(Date.parse(doc.uploadedAt || 0)).getTime(), {
            store: false,
            index: 'not_analyzed',
          });

          index('uploadedBy', doc.uploadedBy, {
            store: true,
            index: 'not_analyzed',
          });

          index('sort.uploadedBy', doc.uploadedBy, {
            store: false,
            index: 'not_analyzed',
          });

          index('location', doc.location, {
            store: true,
            index: 'not_analyzed',
          });

          index('mediaType', doc.mediaType, {
            store: true,
            index: 'not_analyzed',
          });

          index('originalFileName', doc.original.fileName, {
            store: true,
            index: 'not_analyzed',
          });

          index('sort.originalFileName', doc.original.fileName, {
            store: false,
            index: 'not_analyzed',
          });

          index('fileSize', doc.fileSize || doc.original.fileSize, {
            store: true,
            index: 'not_analyzed',
          });

          index('sort.fileSize', doc.fileSize || doc.original.fileSize, {
            store: false,
            index: 'not_analyzed',
          });

          index('mimeType', doc.mimeType || doc.original.mimeType, {
            store: true,
            index: 'not_analyzed',
          });

          index('sort.mimeType', doc.mimeType || doc.original.mimeType, {
            store: false,
            index: 'not_analyzed',
          });

          index('id', doc._id, {
            store: true,
            index: 'not_analyzed',
          });

          if (doc.entity) {
            index('entity', doc.entity.id, {
              store: true,
              index: 'not_analyzed',
            });
          }
        }
      },
    },
  },
};

module.exports = ddoc;
