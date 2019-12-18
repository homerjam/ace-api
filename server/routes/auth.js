module.exports = async ({
  Auth,
  router,
  authMiddleware,
  permissionMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {
  const config = await getConfig();
  const auth = Auth(config);

  router.get(
    '/auth/user.:ext?',
    auth.jwtCheck,
    asyncMiddleware(async (req, res) => {
      try {
        const authUser = await auth.authUser(
          req.query.slug,
          req.headers.authorization.split(' ')[1]
        );

        handleResponse(req, res, authUser);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.get(
    '/auth/provider/:provider/config',
    authMiddleware,
    permissionMiddleware.bind(null, ['settings', 'userSettings']),
    asyncMiddleware(async (req, res) => {
      if (!config.provider[req.params.provider]) {
        res.status(404);
        res.send({});
        return;
      }

      res.status(200);
      res.send({ clientId: config.provider[req.params.provider].clientId });
    })
  );

  router.get(
    '/auth/provider/:provider',
    authMiddleware,
    permissionMiddleware.bind(null, 'settings'),
    (req, res) => {
      res.status(req.query.error ? 500 : 200);
      res.send(
        `${req.params.provider}: ${
          req.query.error_description
            ? req.query.error_description
            : 'successfully authenticated'
        }`
      );
    }
  );

  router.post(
    '/auth/provider/:provider',
    authMiddleware,
    permissionMiddleware.bind(null, 'settings'),
    asyncMiddleware(async (req, res) => {
      const auth = Auth(await getConfig(req.session.slug));

      try {
        handleResponse(
          req,
          res,
          await auth.authProvider(req.params.provider, req.body)
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.put(
    '/auth/provider/:provider/refresh',
    authMiddleware,
    asyncMiddleware(async (req, res) => {
      const auth = Auth(await getConfig(req.session.slug));

      try {
        handleResponse(
          req,
          res,
          await auth.authProvider(req.params.provider, req.body, null, true)
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.post(
    '/auth/provider/:provider/:userId',
    authMiddleware,
    permissionMiddleware.bind(null, 'userSettings'),
    asyncMiddleware(async (req, res) => {
      const auth = Auth(await getConfig(req.session.slug));

      try {
        handleResponse(
          req,
          res,
          await auth.authProvider(
            req.params.provider,
            req.body,
            req.params.userId
          )
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.put(
    '/auth/provider/:provider/:userId/refresh',
    authMiddleware,
    asyncMiddleware(async (req, res) => {
      const auth = Auth(await getConfig(req.session.slug));

      try {
        handleResponse(
          req,
          res,
          await auth.authProvider(
            req.params.provider,
            req.body,
            req.params.userId,
            true
          )
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
