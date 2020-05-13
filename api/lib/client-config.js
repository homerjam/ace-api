const _ = require('lodash');
const Db = require('./db');
const Utils = require('./utils');

const DEFAULT_CLIENT_CONFIG = {
  _id: 'config',
  client: {},
  assets: {},
  schemas: [],
  taxonomies: [],
};

class ClientConfig {
  constructor(config) {
    this.config = config;

    return this;
  }

  async get() {
    let clientConfig = DEFAULT_CLIENT_CONFIG;

    try {
      clientConfig = await Db.connect(this.config).get('config');

      clientConfig = _.merge({}, DEFAULT_CLIENT_CONFIG, clientConfig);
    } catch (error) {
      //
    }

    clientConfig.slug = this.config.slug;

    return clientConfig;
  }

  async set(clientConfig) {
    clientConfig._id = 'config';

    clientConfig = await Utils.createOrUpdate(this.config, clientConfig);

    clientConfig = _.merge({}, DEFAULT_CLIENT_CONFIG, clientConfig);

    return clientConfig;
  }
}

module.exports = ClientConfig;
