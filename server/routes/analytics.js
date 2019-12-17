module.exports = ({
  Analytics,
  router,
  authMiddleware,
  cacheMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {
  router.get(
    '/analytics.:ext?',
    authMiddleware,
    cacheMiddleware,
    asyncMiddleware(async (req, res) => {
      const analytics = Analytics(await getConfig());

      try {
        handleResponse(req, res, await analytics.get(req.query), true);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
