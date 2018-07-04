module.exports = ({
  Shopify,
  router,
  authMiddleware,
  cacheMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {

  /**
   * @swagger
   * /shopify/catalog:
   *  get:
   *    tags:
   *      - shopify
   *    summary: Get Facebook product feed xml
   * #   description: Get Facebook product feed xml
   *    produces:
   *      - application/rss+xml
   *    parameters:
   *      - name: shopLink
   *        description: Shop URL
   *        in: query
   *        required: true
   *        type: string
   *      - name: productLinkTemplate
   *        description: Product URL Handlebars template, containing {{handle}}
   *        in: query
   *        required: true
   *        type: string
   *    responses:
   *      200:
   *        description: XML Product Feed
   */
  router.get(
    '/shopify/catalog.:ext?',
    authMiddleware,
    cacheMiddleware,
    asyncMiddleware(async (req, res) => {
      const shopify = Shopify(await getConfig(req.session.slug));

      try {
        res.setHeader('Content-Type', 'application/rss+xml');
        handleResponse(req, res, await shopify.getCatalog(req.query), true);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

};
