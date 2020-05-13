const _ = require('lodash');
const got = require('got');

class Instagram {
  constructor(options) {
    const defaultOptions = {
      client_id: null,
      access_token: null,
      version: 'v1',
      host: 'https://api.instagram.com',
    };

    this.options = _.merge({}, defaultOptions, options || {});

    return this;
  }

  async get(endpoint, query) {
    const result = await got(
      [this.options.host, this.options.version, endpoint].join('/'),
      {
        searchParams: {
          access_token: this.options.access_token,
          client_id: this.options.client_id,
          ...query,
        },
        responseType: 'json',
      }
    );
    return result;
  }
}

module.exports = Instagram;
