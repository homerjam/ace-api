const util = require('util');
const _ = require('lodash');
const EmbedlyApi = require('embedly');

class Embedly {
  constructor(appConfig) {
    this.appConfig = appConfig;

    return this;
  }

  async oembed(urls) {
    const embedly = new EmbedlyApi({
      key: this.appConfig.embedly.apiKey,
    });

    const oembed = util.promisify(embedly.oembed);

    const result = await oembed({
      urls: _.isArray(urls) ? urls : [urls],
      format: 'json',
    });

    return result;
  }
}

module.exports = Embedly;
