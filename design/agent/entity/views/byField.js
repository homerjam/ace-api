module.exports = function (doc) {
  if (doc.type === 'entity') {
    var _ = require('views/lib/lodash');

    _.forEach(doc.fields, function (field, fieldSlug) {
      if (_.isString(field.value)) {
        emit([fieldSlug, field.value], 1);
      }
      if (_.isArray(field.value)) {
        field.value.forEach(function(obj) {
          if (obj.title) {
            emit([fieldSlug, obj.title], 1);
          }
        });
      }
    });

  }
};
