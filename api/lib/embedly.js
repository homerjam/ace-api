const util = require('util');
const _ = require('lodash');
const EmbedlyApi = require('embedly');

class Embedly {
  constructor(config) {
    this.config = config;

    return this;
  }

  async oembed(urls) {
    const embedly = new EmbedlyApi({
      key: this.config.embedly.apiKey,
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
