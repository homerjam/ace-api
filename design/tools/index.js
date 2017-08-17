var ddoc = {
  _id: '_design/tools',
  views: {

  },
  lists: {

  },
  filters: {
    changesEntity: function(doc, req) {
      if (!doc._deleted && doc.type === 'entity') {
        return true;
      }

      return false;
    },
  },
};

module.exports = ddoc;

