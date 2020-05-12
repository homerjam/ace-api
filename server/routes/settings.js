module.exports = ({
  Settings,
  router,
  authMiddleware,
  permissionMiddleware,
  // cacheMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {
  /**
   * @swagger
   * definitions:
   *  Settings:
   *    type: object
   *    properties:
   *      metadata:
   *        type: object
   *        properties:
   *          description:
   *            type: string
   */

  /**
   * @swagger
   * /settings:
   *  post:
   *    tags:
   *      - settings
   *    summary: Create settings
   *    produces:
   *      - application/json
   *    parameters:
   *      - name: settings
   *        description: Settings
   *        in: body
   *        required: true
   *        schema:
   *          type: object
   *          $ref: '#/definitions/Settings'
   *    responses:
   *      200:
   *        description: Settings
   *        schema:
   *          type: object
   *          $ref: '#/definitions/Settings'
   */
  router.post(
    '/settings.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'settingsCreate'),
    asyncMiddleware(async (req, res) => {
      const settings = Settings(await getConfig(req.session));

      try {
        handleResponse(req, res, await settings.create(req.body.settings));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  /**
   * @swagger
   * /settings:
   *  get:
   *    tags:
   *      - settings
   *    summary: Read settings
   *    produces:
   *      - application/json
   *    parameters:
   *      - name: slug
   *        description: Settings slug
   *        in: query
   *        required: true
   *        type: string
   *    responses:
   *      200:
   *        description: Settings
   *        schema:
   *          type: object
   *          $ref: '#/definitions/Settings'
   */
  router.get(
    '/settings.:ext?',
    // cacheMiddleware,
    permissionMiddleware.bind(null, 'settingsRead'),
    asyncMiddleware(async (req, res) => {
      try {
        handleResponse(
          req,
          res,
          await Settings(await getConfig(req.session)).read(
            req.query.slug || req.query.settingsSlug
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
   * /settings:
   *  put:
   *    tags:
   *      - settings
   *    summary: Update settings
   *    produces:
   *      - application/json
   *    parameters:
   *      - name: settings
   *        description: Settings
   *        in: body
   *        required: true
   *        schema:
   *          type: object
   *          $ref: '#/definitions/Settings'
   *    responses:
   *      200:
   *        description: Settings
   *        schema:
   *          type: object
   *          $ref: '#/definitions/Settings'
   */
  router.put(
    '/settings.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'settingsUpdate'),
    asyncMiddleware(async (req, res) => {
      const settings = Settings(await getConfig(req.session));

      try {
        handleResponse(req, res, await settings.update(req.body.settings));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
