var fs = require('fs');

var ddoc = {
  _id: '_design/entity',
  views: {
    lib: {
      lodash: fs.readFileSync('./node_modules/lodash/lodash.min.js').toString('utf8'),
    },
    byFile: {
      map: require('./views/byFile'),
    },
    byId: {
      map: require('./views/byId'),
    },
    byIdExtended: {
      map: require('./views/byIdExtended'),
    },
    byTaxonomyTerm: {
      map: require('./views/byTaxonomyTerm'),
      reduce: function (keys, values) {
        var unique = function (v, i, self) {
          return self.indexOf(v) === i;
        };
        return values.filter(unique);
      },
    },
    revs: {
      map: function (doc) {
        if (doc.type === 'entity') {
          emit(doc._id, doc._rev);
        }
      },
    },
    active: {
      map: function (doc) {
        if (doc.type === 'entity' && !doc.trashed) {
          emit([doc.schema, doc.modified], null);
        }
      },
    },
    trashed: {
      map: function (doc) {
        if (doc.type === 'entity' && doc.trashed) {
          emit([doc.schema, doc.modified], null);
        }
      },
    },
    children: {
      map: require('./views/children'),
    },
  },
  indexes: {
    all: {
      index: require('./indexes/all'),
    },
  },
  fulltext: {
    all: {
      index: require('./indexes/all'),
    },
  },
};

module.exports = ddoc;
