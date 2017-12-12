/* global emit */

module.exports = function (doc) {
  if (doc.type === 'entity') {

    function forEach(obj, fn) {
      Object.keys(obj).forEach(function (key) {
        fn(obj[key], key, obj);
      });
    }

    forEach(doc.fields, function (field) {

      if (field.type === 'file' && field.value && field.value.id) {
        emit(field.value.id, null);
      }

    });
  }
};
