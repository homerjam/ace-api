const _ = require('lodash');
const axios = require('axios');

module.exports = ({
  Auth,
  ClientConfig,
  router,
  cacheMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {

  const providerApiBaseUrl = {
    google: 'https://www.googleapis.com',
    instagram: 'https://api.instagram.com',
    spotify: 'https://api.spotify.com',
    vimeo: 'https://api.vimeo.com',
  };

  const providerApiHandler = asyncMiddleware(async (req, res) => {
    const method = req.method;
    const provider = req.params[0];
    const userId = req.params[2] ? req.params[1] : null;
    const endpoint = (req.params[2] || req.params[1]).split('/').filter(param => param !== '').join('/');

    const config = await getConfig(req.session.slug);

    const cc = ClientConfig(config);

    let clientConfig = await cc.get();
    let providerConfig;

    if (userId) {
      if (!clientConfig.userSettings[userId]) {
        throw Error(`User settings not found: ${userId}`);
      }
      providerConfig = clientConfig.userSettings[userId].provider[provider];
    } else {
      providerConfig = clientConfig.provider[provider];
    }

    if (Math.floor(new Date().getTime() / 1000) - (providerConfig.begins || 0) > providerConfig.expires_in) {
      const auth = Auth(await getConfig(req.session.slug));

      if (userId) {
        clientConfig = await auth.authProvider(provider, {}, userId, true);
        providerConfig = clientConfig.userSettings[userId].provider[provider];
      } else {
        clientConfig = await auth.authProvider(provider, {}, null, true);
        providerConfig = clientConfig.provider[provider];
      }
    }

    let params = _.merge({}, req.query);
    params = _.omitBy(params, (value, key) => /^(__)/.test(key));

    if (!/bearer/i.test(providerConfig.token_type)) {
      params.access_token = providerConfig.access_token;
    }

    try {
      const result = await axios.request({
        url: endpoint,
        baseURL: providerApiBaseUrl[provider],
        method,
        headers: {
          Authorization: `Bearer ${providerConfig.access_token}`,
        },
        params,
      });

      handleResponse(req, res, result.data, true);
    } catch (error) {
      handleError(req, res, error);
    }
  });

  router.all(
    /\/provider\/([^/]+)\/([^/]+)\/api\/?(.+)?/,
    cacheMiddleware,
    providerApiHandler,
  );

  router.all(
    /\/provider\/([^/]+)\/api\/?(.+)?/,
    cacheMiddleware,
    providerApiHandler,
  );

};
