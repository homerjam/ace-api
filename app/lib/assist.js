const _ = require('lodash');
const axios = require('axios');
const passwordHash = require('password-hash');
const ClientConfig = require('./client-config');

class Assist {
  constructor(appConfig) {
    this.appConfig = appConfig;

    return this;
  }

  async deleteFiles(fileNames) {
    const clientConfig = await new ClientConfig(this.appConfig).read();

    const assetsSlug = _.get(clientConfig, 'assets.slug', this.appConfig.slug);

    if (fileNames.length === 0) {
      return [];
    }

    const result = (
      await axios.post(
        `${this.appConfig.assist.url}/${assetsSlug}/file/delete`,
        { fileNames },
        {
          auth: {
            username: this.appConfig.assist.username,
            password: passwordHash.generate(this.appConfig.assist.password),
          },
        }
      )
    ).data;

    return result;
  }
}

module.exports = Assist;
