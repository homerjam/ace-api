module.exports = ({
  Embedly,
  router,
  authMiddleware,
  asyncMiddleware,
  getAppConfig,
  handleResponse,
  handleError,
}) => {
  router.get(
    '/embedly/oembed.:ext?',
    authMiddleware,
    asyncMiddleware(async (req, res) => {
      const embedly = Embedly(await getAppConfig());

      try {
        handleResponse(
          req,
          res,
          await embedly.oembed(req.query.url || req.query.urls)
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
