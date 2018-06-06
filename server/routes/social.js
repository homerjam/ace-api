module.exports = ({
  ClientConfig,
  Instagram,
  router,
  cacheMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {

  const instagramAccessTokenMap = {};

  router.get(
    /\/social\/twitter\/([^/]+)\/?(.+)?/,
    cacheMiddleware,
    asyncMiddleware(async (req, res) => {
      const method = req.params[0];
      const params = req.params[1].split('/').filter(param => param !== '');

      const config = await getConfig(req.session.slug);

      const Promise = require('bluebird');
      const Twitter = require('twitter');

      const twitter = Promise.promisifyAll(new Twitter({
        consumer_key: config.provider.twitter.consumerKey,
        consumer_secret: config.provider.twitter.consumerSecret,
        access_token_key: config.provider.twitter.accessTokenKey,
        access_token_secret: config.provider.twitter.accessTokenSecret,
      }));

      try {
        handleResponse(req, res, await twitter[`${method}Async`](params.join('/'), req.query), true);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.get(
    /\/social\/instagram\/([^/]+)\/?(.+)?/,
    cacheMiddleware,
    asyncMiddleware(async (req, res) => {
      const method = req.params[0];
      const params = req.params[1].split('/').filter(param => param !== '');

      const config = await getConfig(req.session.slug);

      if (!instagramAccessTokenMap[req.session.slug]) {
        const cc = ClientConfig(config);

        try {
          const clientConfig = await cc.get();
          instagramAccessTokenMap[req.session.slug] = clientConfig.provider.instagram.access_token;
        } catch (error) {
          handleError(res, new Error('Instagram: access_token required'));
          return;
        }
      }

      req.query.access_token = instagramAccessTokenMap[req.session.slug];

      const instagram = Instagram({
        client_id: config.provider.instagram.clientId,
      });

      try {
        const result = await instagram[method](params.join('/'), req.query);
        try {
          delete result.pagination.next_url;
        } catch (error) {
          //
        }
        handleResponse(req, res, result, true);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

};
