module.exports = ({
  Taxonomy,
  router,
  authMiddleware,
  permissionMiddleware,
  cacheMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {
  /**
   * @swagger
   * definitions:
   *  TaxonomyTerm:
   *    type: object
   *    properties:
   *      id:
   *        type: string
   *      title:
   *        type: string
   *      slug:
   *        type: string
   *      terms:
   *        type: array
   *        items:
   *          type: object
   *          $ref: '#/definitions/TaxonomyTerm'
   */

  /**
   * @swagger
   * definitions:
   *  Taxonomy:
   *    type: object
   *    properties:
   *      name:
   *        type: string
   *      slug:
   *        type: string
   *      terms:
   *        type: array
   *        items:
   *          type: object
   *          $ref: '#/definitions/TaxonomyTerm'
   */

  /**
   * @swagger
   * /taxonomy:
   *  post:
   *    tags:
   *      - taxonomy
   *    summary: Create taxonomy
   *    produces:
   *      - application/json
   *    parameters:
   *      - name: taxonomy
   *        description: Taxonomy
   *        in: body
   *        required: true
   *        schema:
   *          type: object
   *          $ref: '#/definitions/Taxonomy'
   *    responses:
   *      200:
   *        description: Taxonomy
   *        schema:
   *          type: object
   *          $ref: '#/definitions/Taxonomy'
   */
  router.post(
    '/taxonomy.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'taxonomyCreate'),
    asyncMiddleware(async (req, res) => {
      const taxonomy = Taxonomy(await getConfig(req.session));

      try {
        handleResponse(req, res, await taxonomy.create(req.body.taxonomy));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  /**
   * @swagger
   * /taxonomy:
   *  get:
   *    tags:
   *      - taxonomy
   *    summary: Read taxonomy
   *    produces:
   *      - application/json
   *    parameters:
   *      - name: slug
   *        description: Taxonomy slug
   *        in: query
   *        required: true
   *        type: string
   *    responses:
   *      200:
   *        description: Taxonomy
   *        schema:
   *          type: object
   *          $ref: '#/definitions/Taxonomy'
   */
  router.get(
    '/taxonomy.:ext?',
    cacheMiddleware,
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await Taxonomy(await getConfig(req.session)).read(
            req.query.slug || req.query.taxonomySlug
          ),
          true
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  /**
   * @swagger
   * /taxonomy:
   *  put:
   *    tags:
   *      - taxonomy
   *    summary: Update taxonomy
   *    produces:
   *      - application/json
   *    parameters:
   *      - name: taxonomy
   *        description: Taxonomy
   *        in: body
   *        required: true
   *        schema:
   *          type: object
   *          $ref: '#/definitions/Taxonomy'
   *    responses:
   *      200:
   *        description: Taxonomy
   *        schema:
   *          type: object
   *          $ref: '#/definitions/Taxonomy'
   */
  router.put(
    '/taxonomy.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'taxonomyUpdate'),
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await Taxonomy(await getConfig(req.session)).update(req.body.taxonomy)
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.delete(
    '/taxonomy.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'taxonomyDelete'),
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await Taxonomy(await getConfig(req.session)).delete(
            req.body.taxonomySlug ||
              req.body.taxonomySlugs ||
              req.query.taxonomySlug ||
              req.query.taxonomySlugs
          )
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.post(
    '/taxonomy/term.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'taxonomyUpdate'),
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await Taxonomy(await getConfig(req.session)).createTerm(
            req.body.slug || req.body.taxonomySlug,
            req.body.term
          )
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.put(
    '/taxonomy/term.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'taxonomyUpdate'),
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await Taxonomy(await getConfig(req.session)).updateTerm(
            req.query.term || req.body.term
          )
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.delete(
    '/taxonomy/term.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'taxonomyUpdate'),
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await Taxonomy(await getConfig(req.session)).deleteTerm(
            req.query.term || req.body.term
          )
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
