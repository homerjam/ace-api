const _ = require('lodash');
const Promise = require('bluebird');
const EmbedlyApi = require('embedly');

class Embedly {
  constructor(config) {
    this.config = config;
  }

  oembed(urls) {
    return new Promise((resolve, reject) => {
      const embedly = new EmbedlyApi({
        key: this.config.embedly.apiKey,
      });

      const opts = {
        urls: _.isArray(urls) ? urls : [urls],
        format: 'json',
      };

      embedly.oembed(opts, (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      });
    });
  }
}

module.exports = Embedly;
