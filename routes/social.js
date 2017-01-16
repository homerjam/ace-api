const Promise = require('bluebird');
const Settings = require('../lib/settings');
const Instagram = require('../lib/instagram');
const Twitter = require('twitter');

const co = Promise.coroutine;

module.exports = (config) => {

  const instagram = new Instagram({
    client_id: config.instagram.clientId,
  });

  const twitter = Promise.promisifyAll(new Twitter({
    consumer_key: config.twitter.consumerKey,
    consumer_secret: config.twitter.consumerSecret,
    access_token_key: config.twitter.accessTokenKey,
    access_token_secret: config.twitter.accessTokenSecret,
  }));

  let instagramSettings;

  config._router.get(/\/social\/twitter\/([^/]+)\/?(.+)?/, config._useCachedResponse, (req, res) => {
    const method = req.params[0];
    const params = req.params[1].split('/').filter(param => param !== '');

    twitter[`${method}Async`](params.join('/'), req.query)
      .then(config._cacheAndSendResponse.bind(null, req, res), config._handleError.bind(null, res));
  });

  config._router.get(/\/social\/instagram\/([^/]+)\/?(.+)?/, config._useCachedResponse, co(function* (req, res) {
    const method = req.params[0];
    const params = req.params[1].split('/').filter(param => param !== '');

    if (!instagramSettings) {
      const settings = new Settings(config._db.bind(null, req));

      instagramSettings = yield settings.settings().then(settings => settings.instagram);

      if (!instagramSettings.access_token) {
        config._handleError(res, new Error('Instagram: access_token required'));
        return;
      }
    }

    req.query.access_token = instagramSettings.access_token;

    instagram[method](params.join('/'), req.query)
      .then((response) => {
        const result = JSON.parse(response);
        try {
          delete result.pagination.next_url;
        } catch (error) {
          //
        }
        config._cacheAndSendResponse(req, res, result);
      }, config._handleError.bind(null, res));
  }));

};
