const _ = require('lodash');
const request = require('request-promise');

class Instagram {
  constructor(options) {
    const defaultOptions = {
      client_id: null,
      access_token: null,
      version: 'v1',
      host: 'https://api.instagram.com',
    };

    this.options = _.merge({}, defaultOptions, options || {});
  }

  async _request(method, endpoint, query) {
    const requestOptions = {
      method,
      url: [this.options.host, this.options.version, endpoint].join('/'),
      qs: {
        access_token: query.access_token || this.options.access_token,
        client_id: query.client_id || this.options.client_id,
      },
    };

    requestOptions.qs = _.extend({}, requestOptions.qs, query);

    const response = await request(requestOptions);

    return JSON.parse(response);
  }

  get(endpoint, query) {
    return this._request('GET', endpoint, query);
  }
}

module.exports = Instagram;
