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
    permissionMiddleware.bind(null, 'readUsers'),
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await User(await getConfig(req.session)).read()
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.post(
    '/user.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'createUsers'),
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await User(await getConfig(req.session)).create(req.body.user)
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.get(
    '/user.:ext?',
    authMiddleware,
    // permissionMiddleware.bind(null, 'readUsers'),
    asyncMiddleware(async (req, res) => {
      try {
        // handleResponse(req, res, await User(await getConfig(req.session)).read(req.query.userId));
        handleResponse(
          req,
          res,
          await User(await getConfig(req.session)).read(req.session.userId)
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.put(
    '/user.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'updateUsers'),
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await User(await getConfig(req.session)).update(req.body.user)
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.delete(
    '/user.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'deleteUsers'),
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await User(await getConfig(req.session)).delete(
            req.body.userId || req.query.userId
          )
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
