const Auth = require('../lib/auth');
const Taxonomy = require('../lib/taxonomy');

module.exports = (config) => {

  // config._router.post('/taxonomy.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'taxonomyCreate'), (req, res) => {
  //   const taxonomy = new Taxonomy(config._db.bind(null, req));

  //   taxonomy.create(req.body.items[0])
  //     .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  // });

  config._router.put('/taxonomy.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'taxonomyUpdate'), (req, res) => {
    const taxonomy = new Taxonomy(config._db.bind(null, req));

    taxonomy.update(req.body.items[0])
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.post('/taxonomy/term.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'taxonomyUpdate'), (req, res) => {
    const taxonomy = new Taxonomy(config._db.bind(null, req));

    taxonomy.createTerm(req.body.slug, req.body.term, req.session.email)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.put('/taxonomy/term.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'taxonomyUpdate'), (req, res) => {
    const taxonomy = new Taxonomy(config._db.bind(null, req));

    taxonomy.updateTerm(req.query || req.body)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.delete('/taxonomy/term.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'taxonomyUpdate'), (req, res) => {
    const taxonomy = new Taxonomy(config._db.bind(null, req));

    taxonomy.deleteTerm(req.query || req.body)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  /**
   * @swagger
   * /taxonomy:
   *  get:
   *    tags:
   *      - taxonomy
   *    summary: Get taxonomy
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
   *          properties:
   *            _id:
   *              type: string
   *            _rev:
   *              type: string
   *            title:
   *              type: string
   *            slug:
   *              type: string
   *            terms:
   *              type: array
   *              items:
   *                schema:
   *                  type: object
   *                  properties:
   *                    id:
   *                      type: string
   *                    title:
   *                      type: string
   *                    slug:
   *                      type: string
   *                    terms:
   *                      type: array
   */
  config._router.get('/taxonomy.:ext?', config._useCachedResponse, (req, res) => {
    const taxonomy = new Taxonomy(config._db.bind(null, req));

    taxonomy.read(req.query.slug)
      .then(config._cacheAndSendResponse.bind(null, req, res), config._handleError.bind(null, res));
  });
};
