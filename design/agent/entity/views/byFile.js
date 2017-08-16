module.exports = function (doc) {
  if (doc.type === 'entity') {
    var _ = require('views/lib/lodash');

    _.forEach(doc.fields, function (field) {

      if (field.type === 'file' && field.value && field.value.id) {
        emit(field.value.id, null);
      }

    });
  }
};
