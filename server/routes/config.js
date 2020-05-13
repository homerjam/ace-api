const _ = require('lodash');

module.exports = ({
  ClientConfig,
  router,
  authMiddleware,
  permissionMiddleware,
  asyncMiddleware,
  getAppConfig,
  handleResponse,
  handleError,
}) => {
  router.get(
    '/config/info.:ext?',
    asyncMiddleware(async (req, res) => {
      const clientConfig = await ClientConfig(
        await getAppConfig({ slug: req.query.slug || req.session.slug })
      ).read();

      const clientInfo = _.pick(clientConfig, ['client.name']);

      if (Object.keys(clientInfo).length === 0) {
        handleError(req, res, Error('Account ID not found'));
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
      try {
        handleResponse(
          req,
          res,
          await ClientConfig(await getAppConfig(req.session)).read()
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.put(
    '/config.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'config'),
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await ClientConfig(await getAppConfig(req.session)).update(
            req.body.config
          )
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
