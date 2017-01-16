const Promise = require('bluebird');

const Helpers = require('./helpers');

class Settings {
  constructor(db) {
    this.db = db;
  }

  settings(settings, userId) {
    return new Promise((resolve, reject) => {
      if (settings) {
        settings._id = 'settings';

        settings.modifiedBy = userId;
        settings.modified = Helpers.now();

        Helpers.createOrUpdate(this.db, settings)
          .then(resolve, reject);

        return;
      }

      this.db().getAsync('settings').then(resolve, resolve.bind(null, {}));
    });
  }

}

module.exports = Settings;
