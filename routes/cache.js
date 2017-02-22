module.exports = (config) => {

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
  config._router.get('/cache/clear.:ext?', (req, res) => {
    if (!config.cache) {
      config._sendResponse(res, 'Cache disabled');
      return;
    }

    const itemsCount = config._cache.keys().length;

    config._cache.reset();

    config._sendResponse(res, `Successfully cleared ${itemsCount} items from the cache`);
  });

};
