const _ = require('lodash');
const Promise = require('bluebird');
const Auth = require('./auth');
const Db = require('./db');
const Helpers = require('./helpers');
const Roles = require('./roles');

class ClientConfig {
  constructor(config) {
    this.config = config;
  }

  async clientConfig() {
    const clientConfig = await Db.connect(this.config).getAsync('config');

    clientConfig.roles = Roles;

    return clientConfig;
  }
}


module.exports = ClientConfig;
