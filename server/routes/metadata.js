module.exports = ({
  Settings,
  router,
  cacheMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {
  /**
   * @swagger
   * /metadata:
   *  get:
   *    tags:
   *      - metadata
   *    summary: Get metadata
   *    produces:
   *      - application/json
   *    parameters: []
   *    responses:
   *      200:
   *        description: Metadata
   *        schema:
   *          type: object
   *          properties:
   *            description:
   *              type: string
   */
  router.get(
    '/metadata.:ext?',
    cacheMiddleware,
    asyncMiddleware(async (req, res) => {
      const settings = await Settings(await getConfig(req.session)).read();

      try {
        handleResponse(req, res, settings.metadata, true);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
