module.exports = ({
  User,
  router,
  authMiddleware,
  permissionMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {
  router.get(
    '/users.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'user'),
    asyncMiddleware(async (req, res) => {
      const user = User(await getConfig(req.session));

      try {
        handleResponse(req, res, await user.read());
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.post(
    '/user.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'user'),
    asyncMiddleware(async (req, res) => {
      const user = User(await getConfig(req.session));

      try {
        handleResponse(req, res, await user.create(req.body.user));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.get(
    '/user.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'user'),
    asyncMiddleware(async (req, res) => {
      const user = User(await getConfig(req.session));

      try {
        handleResponse(req, res, await user.read(req.query.userId));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.put(
    '/user.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'user'),
    asyncMiddleware(async (req, res) => {
      const user = User(await getConfig(req.session));

      try {
        handleResponse(req, res, await user.update(req.body.user));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.delete(
    '/user.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'user'),
    asyncMiddleware(async (req, res) => {
      const user = User(await getConfig(req.session));

      try {
        handleResponse(
          req,
          res,
          await user.delete(req.body.userId || req.query.userId)
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
