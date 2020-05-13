const _ = require('lodash');

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
      const clientConfig = await ClientConfig(
        await getConfig({ slug: req.query.slug || req.session.slug })
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
          await ClientConfig(await getConfig(req.session)).read()
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
          await ClientConfig(await getConfig(req.session)).update(
            req.body.config
          )
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
