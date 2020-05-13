module.exports = ({
  Settings,
  router,
  cacheMiddleware,
  asyncMiddleware,
  getAppConfig,
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
      const settings = await Settings(await getAppConfig(req.session)).read();

      try {
        handleResponse(req, res, settings.metadata);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
