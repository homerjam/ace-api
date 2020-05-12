const _ = require('lodash');
const Db = require('./db');
const Utils = require('./utils');

const defaultSettings = {
  darkMode: true,
  metadata: {
    description: '',
  },
  provider: {
    google: {},
    instagram: {},
    vimeo: {},
  },
};

class Settings {
  constructor(config) {
    this.config = config;
  }

  async create(settings) {
    settings = await this.update(settings);
    return settings;
  }

  async read() {
    const settings = await Db.connect(this.config).get('settings');

    return _.merge(defaultSettings, settings);
  }

  async update(settings) {
    try {
      const oldSettings = await this.read();
      settings = _.merge({}, oldSettings, settings);
    } catch (error) {
      //
    }

    settings._id = 'settings';
    settings.type = 'settings';

    settings = await Utils.createOrUpdate(this.config, settings);

    return _.merge(defaultSettings, settings);
  }
}

module.exports = Settings;
