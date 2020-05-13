const _ = require('lodash');
const Db = require('./db');
const Utils = require('./utils');

const defaultSettings = {
  metadata: {
    description: '',
  },
  darkMode: true,
  provider: {
    google: {},
    instagram: {},
    spotify: {},
    vimeo: {},
  },
};

class Settings {
  constructor(appConfig) {
    this.appConfig = appConfig;

    return this;
  }

  async create(settings) {
    settings = await this.update(settings);
    return settings;
  }

  async read() {
    const settings = await Db.connect(this.appConfig).get('settings');

    return _.merge({}, defaultSettings, settings.settings);
  }

  async update(settings) {
    try {
      const oldSettings = await this.read();
      settings = _.merge({}, oldSettings, settings);
    } catch (error) {
      //
    }

    settings = await Utils.createOrUpdate(this.appConfig, {
      settings,
      _id: 'settings',
      type: 'settings',
    });

    return _.merge({}, defaultSettings, settings.settings);
  }
}

module.exports = Settings;
