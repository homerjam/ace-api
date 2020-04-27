const _ = require('lodash');
const ClientConfig = require('./client-config');

class Settings {
  constructor(config) {
    this.config = config;

    return this;
  }

  async update(settings) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    clientConfig.client = _.merge({}, clientConfig.client, settings);

    return cc.set(clientConfig);
  }
}

module.exports = Settings;
