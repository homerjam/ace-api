module.exports = function (doc) {
  if (doc.type === 'entity') {
    var _ = require('views/lib/lodash');

    _.forEach(doc.fields, function(field) {
      if (!_.isArray(field.value)) {
        return;
      }

      _.forEach(field.value, function(obj) {
        if (!_.isObject(obj)) {
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
