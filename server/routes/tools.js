module.exports = ({
  Tools,
  router,
  authMiddleware,
  permissionMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {
  router.get(
    '/tools/export-db.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'tools'),
    asyncMiddleware(async (req, res) => {
      const tools = Tools(await getConfig(req.session.slug));

      try {
        const db = await tools.getDb();

        res.setHeader(
          'Content-Disposition',
          `attachment; filename=${req.session.slug}.json`
        );
        res.setHeader('Content-Type', 'application/json');
        res.status(200);
        res.send(db);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.get(
    '/tools/changes.:ext?',
    authMiddleware,
    asyncMiddleware(async (req, res) => {
      const tools = Tools(await getConfig(req.session.slug));

      try {
        handleResponse(req, res, await tools.getChanges());
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
