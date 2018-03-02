const _ = require('lodash');
const axios = require('axios');
const passwordHash = require('password-hash');
const ClientConfig = require('./client-config');

class Assist {
  constructor(config) {
    this.config = config;
  }

  async deleteFiles(fileNames) {
    const cc = new ClientConfig(this.config);
    const clientConfig = await cc.get();

    const assetsSlug = _.get(clientConfig, 'assets.slug', this.config.slug);

    if (fileNames.length === 0) {
      return [];
    }

    const result = (await axios.post(`${this.config.assist.url}/${assetsSlug}/file/delete`, { fileNames }, {
      auth: {
        username: this.config.assist.username,
        password: passwordHash.generate(this.config.assist.password),
      },
    })).data;

    return result;
  }

}

module.exports = Assist;
