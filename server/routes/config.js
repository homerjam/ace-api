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
