/* global emit */

module.exports = function(doc) {
  if (doc.type === 'entity') {
    function forEach(obj, fn) {
      Object.keys(obj).forEach(function(key) {
        fn(obj[key], key, obj);
      });
    }

    forEach(doc.fields, function(field) {
      if (
        field.type === 'taxonomy' &&
        field.value &&
        field.value.terms &&
        field.value.terms.length
      ) {
        forEach(field.value.terms, function(term) {
          if (term.id) {
            emit(term.id, doc._id);
          }
          forEach(term.parents || [], function(parent) {
            if (parent.id) {
              emit(parent.id, doc._id);
            }
          });
        });
      }
    });
  }
};
