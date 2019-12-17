/* global emit */

module.exports = function(doc) {
  if (doc.type === 'entity') {
    function type(obj) {
      return Object.prototype.toString
        .call(obj)
        .slice(8, -1)
        .toLowerCase();
    }

    function forEach(obj, fn) {
      Object.keys(obj).forEach(function(key) {
        fn(obj[key], key, obj);
      });
    }

    forEach(doc.fields, function(field, fieldSlug) {
      if (type(field.value) === 'string') {
        emit([fieldSlug, field.value], 1);
      }

      if (type(field.value) === 'array') {
        field.value.forEach(function(obj) {
          if (type(obj.title) === 'string') {
            emit([fieldSlug, obj.title], 1);
          }
        });
      }
    });
  }
};
