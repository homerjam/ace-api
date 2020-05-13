module.exports = ({
  Schema,
  router,
  authMiddleware,
  permissionMiddleware,
  asyncMiddleware,
  getAppConfig,
  handleResponse,
  handleError,
}) => {
  router.post(
    '/schema.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'schema'),
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await Schema(await getAppConfig(req.session)).create(req.body.schema)
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.get(
    '/schema.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'schema'),
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await Schema(await getAppConfig(req.session)).read(req.query.schemaId)
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.put(
    '/schema.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'schema'),
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await Schema(await getAppConfig(req.session)).update(req.body.schema)
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.delete(
    '/schema.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'schema'),
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await Schema(await getAppConfig(req.session)).delete(
            req.body.schemaSlug ||
              req.body.schemaSlugs ||
              req.query.schemaSlug ||
              req.query.schemaSlugs
          )
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.put(
    '/schemas.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'schema'),
    asyncMiddleware(async (req, res) => {
      const schema = Schema(await getAppConfig(req.session));

      try {
        handleResponse(req, res, await schema.updateAll(req.body.schemas));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
