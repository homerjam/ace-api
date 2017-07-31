module.exports = function (doc) {
  if (doc.type === 'entity') {
    var _ = require('views/lib/lodash');

    _.forEach(doc.fields, function(field) {
      if (!_.isObject(field.value)) {
        return;
      }

      if (field.value.type === 'taxonomy') {
        _.forEach(field.value.terms || [], function (term) {
          if (term.id) {
            emit(term.id, doc._id);
          }
          _.forEach(term.parents || [], function (parent) {
            if (parent.id) {
              emit(parent.id, doc._id);
            }
          });
        });
      }
    });
  }
};
