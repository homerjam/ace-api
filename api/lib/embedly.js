const util = require('util');
const _ = require('lodash');
const EmbedlyApi = require('embedly');

class Embedly {
  constructor(config) {
    this.config = config;
  }

  async oembed(urls) {
    const embedly = new EmbedlyApi({
      key: this.config.embedly.apiKey,
    });

    const oembed = util.promisify(embedly.oembed);

    return await oembed({
      urls: _.isArray(urls) ? urls : [urls],
      format: 'json',
    });
  }
}

module.exports = Embedly;
