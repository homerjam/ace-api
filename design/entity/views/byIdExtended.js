module.exports = function (doc) {
  if (doc.type === 'entity') {
    var _ = require('views/lib/lodash');

    emit(doc._id, {
      type: 'entity',
    });

    _.forEach(doc.fields, function (field, fieldSlug) {
      var fieldValue = field.value;

      if (_.isArray(fieldValue)) {
        _.forEach(fieldValue, function (item, index) {
          if (_.isObject(item) && item.type === 'entity' && item.id) {
            emit(doc._id, {
              _id: item.id,
              type: 'field',
              slug: fieldSlug,
              index: index,
            });

            emit(item.id, {
              _id: doc.id,
              type: 'parent',
            });
          }
        });
      }

      if (_.isObject(fieldValue)) {
        if (fieldValue.type === 'file' && fieldValue.id) {
          emit(doc._id, {
            _id: fieldValue.id,
            type: 'field',
            slug: fieldSlug,
          });
        }
      }

    });

  }
};
