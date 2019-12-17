module.exports = ({
  Jwt,
  router,
  authMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  // handleError,
}) => {
  /**
   * @swagger
   * /token:
   *  get:
   *    tags:
   *      - token
   *    summary: Get JWT
   *    description: Get Json Web Token (JWT) for API access
   *    produces:
   *      - application/json
   *    parameters:
   *      - name: slug
   *        description: Slug for token payload (super user only)
   *        in: query
   *        required: false
   *        type: string
   *      - name: userId
   *        description: User ID for token payload (super user only)
   *        in: query
   *        required: false
   *        type: string
   *      - name: role
   *        description: Role for token payload (super user only)
   *        in: query
   *        required: false
   *        type: string
   *      - name: expiresIn
   *        description: Duration of token in seconds
   *        in: query
   *        required: false
   *        type: number
   *    responses:
   *      200:
   *        description: Token
   */

  router.get(
    '/token.:ext?',
    authMiddleware,
    asyncMiddleware(async (req, res) => {
      const config = await getConfig();

      const payload = {
        role: req.session.role,
        slug: req.session.slug,
        userId: req.session.userId,
      };

      if (
        req.session.role === 'super' ||
        config.environment === 'development'
      ) {
        payload.role = req.query.role || req.session.role || config.dev.role;
        payload.slug = req.query.slug || req.session.slug || config.dev.slug;
        if (payload.role !== 'guest') {
          payload.userId =
            req.query.userId || req.session.userId || config.dev.userId;
        }
      }

      const _ = require('lodash');

      let options = _.pickBy(req.query, (value, key) =>
        /^(expiresIn|notBefore|audience|issuer|jwtid|subject|noTimestamp|header)$/.test(
          key
        )
      );

      options = _.mapValues(options, value => {
        if (!_.isNaN(+value)) {
          // Check if value is a numeric string
          return +value; // Convert numeric string to number
        }
        return value;
      });

      const jwt = Jwt(config);

      const token = jwt.signToken(payload, options);

      req.session.apiToken = token;

      const response = {
        token,
        payload,
        options,
      };

      handleResponse(req, res, response);
    })
  );
};
