module.exports = ({
  ClientConfig,
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
      const cc = ClientConfig(await getConfig(req.session));

      const clientConfig = await cc.get();

      try {
        handleResponse(req, res, clientConfig.client.metadata, true);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
