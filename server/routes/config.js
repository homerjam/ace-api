const pick = require('lodash/pick');

module.exports = ({
  ClientConfig,
  router,
  authMiddleware,
  permissionMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {

  router.get(
    '/config/info.:ext?',
    asyncMiddleware(async (req, res) => {
      const clientConfig = ClientConfig(await getConfig(req.query.slug || req.session.slug));

      const clientInfo = pick((await clientConfig.get()), [
        'client.name',
      ]);

      if (Object.keys(clientInfo).length === 0) {
        handleError(req, res, new Error('Account ID not found'));
        return;
      }

      try {
        handleResponse(req, res, clientInfo);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.get(
    '/config.:ext?',
    authMiddleware,
    asyncMiddleware(async (req, res) => {
      const clientConfig = ClientConfig(await getConfig(req.session.slug));

      try {
        handleResponse(req, res, await clientConfig.get());
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.post(
    '/config.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'config'),
    asyncMiddleware(async (req, res) => {
      const clientConfig = ClientConfig(await getConfig(req.session.slug));

      try {
        handleResponse(req, res, await clientConfig.set(req.body.config));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

};
