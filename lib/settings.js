const Promise = require('bluebird');
const Db = require('./db');
const Helpers = require('./helpers');

class Settings {
  constructor(config) {
    this.config = config;
  }

  settings(settings, userId) {
    return new Promise((resolve, reject) => {
      if (settings) {
        settings._id = 'settings';

        settings.modifiedBy = userId;
        settings.modified = Helpers.now();

        Helpers.createOrUpdate(this.config, settings)
          .then(resolve, reject);

        return;
      }

      Db.connect(this.config).getAsync('settings').then(resolve, resolve.bind(null, {}));
    });
  }

}

module.exports = Settings;
