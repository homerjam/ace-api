/* eslint no-unused-vars: 1 */
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

    emit(doc._id, { _id: doc._id, type: 'entity' });

    forEach(doc.fields, function(field, fieldSlug) {
      var fieldValue = field.value;

      if (type(fieldValue) === 'array') {
        forEach(fieldValue, function(item, index) {
          if (type(item) === 'object' && item.type === 'entity' && item.id) {
            // emit(doc._id, {
            //   _id: item.id,
            //   type: 'field',
            //   slug: fieldSlug,
            //   index: index,
            // });
          }
        });
      }
    });
  }
};
