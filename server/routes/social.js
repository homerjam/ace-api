module.exports = ({
  Settings,
  Instagram,
  router,
  cacheMiddleware,
  asyncMiddleware,
  getAppConfig,
  handleResponse,
  handleError,
}) => {
  const instagramAccessTokenMap = {};

  router.get(
    /\/social\/twitter\/([^/]+)\/?(.+)?/,
    cacheMiddleware,
    asyncMiddleware(async (req, res) => {
      const method = req.params[0];
      const params = req.params[1].split('/').filter((param) => param !== '');

      const appConfig = await getAppConfig(req.session);

      const Twitter = require('twitter');

      const twitter = new Twitter({
        consumer_key: appConfig.provider.twitter.consumerKey,
        consumer_secret: appConfig.provider.twitter.consumerSecret,
        access_token_key: appConfig.provider.twitter.accessTokenKey,
        access_token_secret: appConfig.provider.twitter.accessTokenSecret,
      });

      try {
        handleResponse(
          req,
          res,
          await twitter[`${method}`](params.join('/'), req.query)
        );
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
      const params = req.params[1].split('/').filter((param) => param !== '');

      const appConfig = await getAppConfig(req.session);

      let accessToken = instagramAccessTokenMap[req.session.slug];

      if (!accessToken) {
        try {
          const settings = await Settings(
            await getAppConfig(req.session)
          ).read();
          accessToken = settings.provider.instagram.access_token;
        } catch (error) {
          handleError(res, Error(`Instagram requires 'access_token'`));
          return;
        }
      }

      // eslint-disable-next-line
      instagramAccessTokenMap[req.session.slug] = accessToken;

      const instagram = Instagram({
        client_id: appConfig.provider.instagram.clientId,
      });

      try {
        const result = await instagram[method](params.join('/'), {
          ...req.query,
          access_token: accessToken,
        });
        try {
          delete result.pagination.next_url;
        } catch (error) {
          //
        }
        handleResponse(req, res, result);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
