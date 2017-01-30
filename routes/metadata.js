const Settings = require('../lib/settings');

module.exports = (config) => {

  /**
   * @swagger
   * /metadata:
   *  get:
   *    tags:
   *      - metadata
   *    summary: Get metadata
   *    produces:
   *      - application/json
   *    parameters:
   *    responses:
   *      200:
   *        description: Metadata
   *        schema:
   *          type: object
   *          properties:
   *            description:
   *              type: string
   */
  config._router.get('/metadata.:ext?', config._useCachedResponse, (req, res) => {
    const settings = new Settings(config._db.bind(null, req));

    settings.settings()
      .then((settings) => {
        config._cacheAndSendResponse(req, res, settings.metadata);
      }, config._handleError.bind(null, res));
  });

};
