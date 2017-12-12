/* global emit */

module.exports = function (doc) {
  if (doc.type === 'entity') {

    function type(obj) {
      return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
    }

    function forEach(obj, fn) {
      Object.keys(obj).forEach(function (key) {
        fn(obj[key], key, obj);
      });
    }

    forEach(doc.fields, function(field) {

      if (!type(field.value) === 'array') {
        return;
      }

      forEach(field.value, function(obj) {
        if (!type(obj) === 'object') {
          return;
        }

        if (obj.type === 'entity') {
          emit(obj.id, {
            _id: doc._id,
          });
        }
      });

    });
  }
};
