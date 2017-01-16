module.exports = function (doc) {
  if (doc.type === 'entity') {
    var _ = require('views/lib/lodash');

    _.forEach(doc.fields, function (field, fieldSlug) {
      var fieldValue = field.value;

      if (_.isObject(fieldValue) && fieldValue.type === 'file') {
        emit(fieldValue.id, null);
      }
    });
  }
};
