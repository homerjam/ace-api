module.exports = ({
  Settings,
  router,
  authMiddleware,
  permissionMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {
  router.post(
    '/settings.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'settings'),
    asyncMiddleware(async (req, res) => {
      const settings = Settings(await getConfig(req.session));

      try {
        handleResponse(req, res, await settings.update(req.body.settings));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
