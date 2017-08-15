var fs = require('fs');

var ddoc = {
  _id: '_design/entity',
  lib: {
    lodash: fs.readFileSync('./node_modules/lodash/lodash.min.js').toString('utf8'),
    fuse: fs.readFileSync('./node_modules/fuse.js/dist/fuse.min.js').toString('utf8'),
  },
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
    byField: {
      map: require('./views/byField'),
      reduce: '_sum',
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
  lists: {
    search: require('./lists/search'),
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
