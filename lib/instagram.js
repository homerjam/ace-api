const _ = require('lodash');
const Promise = require('bluebird');
const request = require('request-promise');

module.exports = (options) => {
  const defaultOptions = {
    client_id: null,
    access_token: null,
    version: 'v1',
    host: 'https://api.instagram.com',
  };

  options = _.merge({}, defaultOptions, options || {});

  const _request = (method, endpoint, query) => new Promise((resolve, reject) => {
    const requestOptions = {
      method,
      url: [options.host, options.version, endpoint].join('/'),
      qs: {
        access_token: query.access_token || options.access_token,
        client_id: query.client_id || options.client_id,
      },
    };

    requestOptions.qs = _.extend({}, requestOptions.qs, query);

    request(requestOptions)
      .then((response) => {
        resolve(JSON.parse(response));
      }, reject);
  });

  this.get = (endpoint, query) => _request('GET', endpoint, query);
};
