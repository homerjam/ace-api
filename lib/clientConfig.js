const _ = require('lodash');
const Promise = require('bluebird');
const Auth = require('./auth');
const Db = require('./db');
const Helpers = require('./helpers');
const roles = require('./roles');

const DEFAULT_CLIENT_CONFIG = {
  _id: 'config',
  schemas: [],
  taxonomies: [],
  users: [],
  roles,
};

class ClientConfig {
  constructor(config) {
    this.config = config;
  }

  async get() {
    let clientConfig = DEFAULT_CLIENT_CONFIG;

    try {
      clientConfig = await Db.connect(this.config).getAsync('config');
      clientConfig = _.merge({}, DEFAULT_CLIENT_CONFIG, clientConfig);
    } catch (error) {
      //
    }

    return clientConfig;
  }

  async set(clientConfig) {
    clientConfig._id = 'config';
    delete clientConfig.roles;

    clientConfig = await Helpers.createOrUpdate(this.config, clientConfig);

    return clientConfig;
  }
}


module.exports = ClientConfig;
