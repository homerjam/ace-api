var ddoc = {
  _id: '_design/file',
  views: {
    revs: {
      map: function (doc) {
        if (doc.type === 'file') {
          emit(doc._id, doc._rev);
        }
      },
    },
    active: {
      map: function (doc) {
        if (doc.type === 'file' && doc.entity) {
          emit([doc.location, new Date(Date.parse(doc.uploaded || 0)).getTime()], null);
        }
      },
    },
    trashed: {
      map: function (doc) {
        if (doc.type === 'file' && !doc.entity) {
          emit([doc.location, new Date(Date.parse(doc.uploaded || 0)).getTime()], null);
        }
      },
    },
  },
  lists: {
    key: function () {
      provides('json', function () {
        var row;
        var rows = [];

        while (row = getRow()) {
          rows.push(row.key);
        }

        send(JSON.stringify(rows));
      });
    },
    sort: function (head, req) {
      var row;
      var rows = [];

      while (row = getRow()) {
        rows.push(row);
      }

      rows.sort(function (a, b) {
        if (a.doc[req.query.prop] < b.doc[req.query.prop]) return -1;
        if (a.doc[req.query.prop] > b.doc[req.query.prop]) return 1;
        return 0;
      });

      send(JSON.stringify({
        total_rows: rows.length,
        rows: rows,
      }));
    },
  },
  indexes: {
    all: {
      index: function (doc) {
        if (doc.type === 'file') {
          index('trashed', doc.entity ? false : true, {
            store: true,
            index: 'not_analyzed',
          });

          index('uploaded', doc.uploaded, {
            store: true,
            index: 'not_analyzed',
          });

          index('sort.uploaded', new Date(Date.parse(doc.uploaded || 0)).getTime(), {
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
