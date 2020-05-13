const _ = require('lodash');
const Db = require('./db');
const Utils = require('./utils');

const defaultClientConfig = {
  client: {},
  assets: {},
  schemas: [],
  taxonomies: [],
};

class ClientConfig {
  constructor(appConfig) {
    this.appConfig = appConfig;

    return this;
  }

  async create(config) {
    config = await this.update(config);
    return config;
  }

  async read() {
    const config = await Db.connect(this.appConfig).get('config');

    return _.merge({}, defaultClientConfig, config.config);
  }

  async update(config) {
    config = await Utils.createOrUpdate(this.appConfig, {
      config,
      _id: 'config',
      type: 'config',
    });

    return _.merge({}, defaultClientConfig, config.config);
  }
}

module.exports = ClientConfig;
