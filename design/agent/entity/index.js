var fs = require('fs');

var ddoc = {
  _id: '_design/entity',
  views: {
    lib: {
      lodash: fs.readFileSync('./node_modules/lodash/lodash.min.js').toString('utf8'),
    },
    byId: {
      map: require('./views/byId'),
    },
    byIdExtended: {
      map: require('./views/byIdExtended'),
    },
    byChildren: {
      map: require('./views/byChildren'),
    },
    byFile: {
      map: require('./views/byFile'),
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
    trashed: {
      map: function (doc) {
        if (doc.type === 'entity' && doc.trashed) {
          emit(doc._id, null);
        }
      },
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
