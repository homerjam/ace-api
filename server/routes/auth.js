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
    '/auth/:provider/config',
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
    '/auth/:provider',
    authMiddleware,
    permissionMiddleware.bind(null, 'settings'),
    (req, res) => {
      res.status(req.query.error ? 500 : 200);
      res.send(`${req.params.provider}: ${(req.query.error_description ? req.query.error_description : 'successfully authenticated')}`);
    }
  );

  router.post(
    '/auth/:provider',
    authMiddleware,
    permissionMiddleware.bind(null, 'settings'),
    asyncMiddleware(async (req, res) => {
      const auth = Auth(await getConfig(req.session.slug));

      const providerAuth = await auth.authProvider(req.params.provider, req.body);

      try {
        handleResponse(req, res, await auth.updateProviderClientConfig(req.params.provider, providerAuth));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.put(
    '/auth/:provider',
    authMiddleware,
    permissionMiddleware.bind(null, 'settings'),
    asyncMiddleware(async (req, res) => {
      const auth = Auth(await getConfig(req.session.slug));

      const providerAuth = await auth.authProvider(req.params.provider, req.body, true);

      try {
        handleResponse(req, res, await auth.updateProviderClientConfig(req.params.provider, providerAuth));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.post(
    '/auth/:provider/:userId',
    authMiddleware,
    permissionMiddleware.bind(null, 'userSettings'),
    asyncMiddleware(async (req, res) => {
      const auth = Auth(await getConfig(req.session.slug));

      const providerAuth = await auth.authProvider(req.params.provider, req.body);

      try {
        handleResponse(req, res, await auth.updateProviderClientConfig(req.params.provider, providerAuth, req.params.userId));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.put(
    '/auth/:provider/:userId',
    authMiddleware,
    permissionMiddleware.bind(null, 'userSettings'),
    asyncMiddleware(async (req, res) => {
      const auth = Auth(await getConfig(req.session.slug));

      const providerAuth = await auth.authProvider(req.params.provider, req.body, true);

      try {
        handleResponse(req, res, await auth.updateProviderClientConfig(req.params.provider, providerAuth, req.params.userId));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

};
