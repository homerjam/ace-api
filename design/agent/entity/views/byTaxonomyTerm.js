module.exports = function (doc) {
  if (doc.type === 'entity') {
    var _ = require('views/lib/lodash');

    _.forEach(doc.fields, function(field) {

      if (field.type === 'taxonomy' && field.value && field.value.terms && field.value.terms.length) {
        _.forEach(field.value.terms, function (term) {
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
