var fs = require('fs');
var path = require('path');

var ddoc = {
  _id: '_design/entity',
  lib: {
    lodash: fs.readFileSync(path.resolve(__dirname, '../../node_modules/lodash/lodash.min.js')).toString('utf8'),
    fuse: fs.readFileSync(path.resolve(__dirname, '../../node_modules/fuse.js/dist/fuse.js')).toString('utf8'),
  },
  views: {
    byId: {
      map: require('./views/byId'),
    },
    byIdExtended: {
      map: require('./views/byIdExtended'),
    },
    byChildren: {
      map: require('./views/byChildren'),
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
