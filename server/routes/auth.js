module.exports = ({
  Auth,
  router,
  authMiddleware,
  permissionMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {

  router.get(
    '/auth/:provider/config.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'settings'),
    asyncMiddleware(async (req, res) => {
      const config = await getConfig();

      if (!config[req.params.provider]) {
        res.status(404);
        res.send({});
        return;
      }

      res.status(200);
      res.send({ clientId: config[req.params.provider].clientId });
    })
  );

  router.get(
    '/auth/:provider.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'settings'),
    (req, res) => {
      res.status(req.query.error ? 500 : 200);
      res.send(`${req.params.provider}: ${(req.query.error_description ? req.query.error_description : 'successfully authenticated')}`);
    }
  );

  router.post(
    '/auth/:provider.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'settings'),
    asyncMiddleware(async (req, res) => {
      const auth = Auth(await getConfig(req.session.slug));

      try {
        handleResponse(req, res, await auth.authenticateWithProvider(req.params.provider, req.body));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.put(
    '/auth/:provider.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'settings'),
    asyncMiddleware(async (req, res) => {
      const auth = Auth(await getConfig(req.session.slug));

      try {
        handleResponse(req, res, await auth.authenticateWithProvider(req.params.provider, req.body, true));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

};
