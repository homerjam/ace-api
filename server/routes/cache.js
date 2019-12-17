module.exports = ({
  router,
  cache,
  asyncMiddleware,
  getConfig,
  handleResponse,
}) => {
  /**
   * @swagger
   * /cache/clear:
   *  get:
   *    tags:
   *      - cache
   *    summary: Clear cache
   *    description: Clears the LRU cache of API responses
   *    produces:
   *      - text/plain
   *    responses:
   *      200:
   *        description: Result
   */
  router.get(
    '/cache/clear.:ext?',
    asyncMiddleware(async (req, res) => {
      const config = await getConfig();

      if (!config.cache.enabled) {
        handleResponse(req, res, 'Cache disabled');
        return;
      }

      const pattern = cache.store.name === 'redis' ? '*' : undefined;

      cache.keys(pattern).then(keys => {
        const items = keys.filter(key => key.indexOf(req.session.slug) === 0);

        items.forEach(key => cache.del(key));

        handleResponse(req, res, `${items.length} items removed from cache`);
      });
    })
  );
};
