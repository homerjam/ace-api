const _ = require('lodash');
const axios = require('axios');

module.exports = ({
  Provider,
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
    const providerSlug = req.params[0];
    const userId = req.params[2] ? req.params[1] : null;
    const endpoint = (req.params[2] || req.params[1])
      .split('/')
      .filter((param) => param !== '')
      .join('/');

    const provider = Provider(await getConfig(req.session));

    const { providerSettings } = await provider.settings(providerSlug, {
      userId,
    });

    let params = _.merge({}, req.query);

    // Omit any proprietary params
    params = _.omitBy(params, (value, key) => /^(__)/.test(key));

    if (!/bearer/i.test(providerSettings.token_type)) {
      params.access_token = providerSettings.access_token;
    }

    try {
      const result = await axios.request({
        url: endpoint,
        baseURL: providerApiBaseUrl[providerSlug],
        method,
        headers: {
          Authorization: `Bearer ${providerSettings.access_token}`,
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
    providerApiHandler
  );

  router.all(
    /\/provider\/([^/]+)\/api\/?(.+)?/,
    cacheMiddleware,
    providerApiHandler
  );

  router.put(
    '/provider/:providerSlug/:userId/refresh',
    asyncMiddleware(async (req, res) => {
      const { providerSlug, userId } = req.params;

      try {
        const provider = Provider(await getConfig(req.session));

        const { updatedUser } = await provider.settings(providerSlug, {
          userId,
          forceRefresh: true,
        });

        handleResponse(req, res, updatedUser || {});
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.put(
    '/provider/:providerSlug/refresh',
    asyncMiddleware(async (req, res) => {
      const { providerSlug } = req.params;

      try {
        const provider = Provider(await getConfig(req.session));

        const { updatedSettings } = await provider.settings(providerSlug, {
          forceRefresh: true,
        });

        handleResponse(req, res, updatedSettings || {});
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
