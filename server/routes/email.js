module.exports = ({
  Email,
  Entity,
  router,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {

  /**
   * @swagger
   * /email/template:
   *  get:
   *    tags:
   *      - email
   *    summary: Render email template
   * #   description: Render email template
   *    produces:
   *      - text/html
   *    parameters:
   *      - name: slug
   *        description: Slug (parent folder name of the template)
   *        in: query
   *        required: false
   *        type: string
   *      - name: templateSlug
   *        description: Template slug (folder name of the template)
   *        in: query
   *        required: true
   *        type: string
   *      - name: entityId
   *        description: Entity `id` from which to render the template
   *        in: query
   *        required: false
   *        type: string
   *      - name: preview
   *        description: Preview mode (disable inlining of styles etc)
   *        in: query
   *        required: false
   *        type: boolean
   *    responses:
   *      200:
   *        description: Template
   */
  router.all(
    '/email/template.:ext?',
    asyncMiddleware(async (req, res) => {
      const input = Object.keys(req.body).length ? req.body : req.query || {};

      const options = {
        data: input.data ? JSON.parse(input.data) : false,
        preview: input.preview ? JSON.parse(input.preview) : false,
        inky: input.inky ? JSON.parse(input.inky) : false,
        mjml: input.mjml ? JSON.parse(input.mjml) : false,
        skipValidation: input.skipValidation ? JSON.parse(input.skipValidation) : false,
      };

      const slug = req.session.slug || input.slug;

      if (!slug) {
        throw new Error('missing slug param');
      }

      async function renderTemplate(data = {}) {
        if (options.data) {
          handleResponse(req, res, data);
          return;
        }

        const email = Email(await getConfig(slug));

        const template = await email.getTemplate(`${slug}/${input.templateSlug}`, data, options);

        try {
          handleResponse(req, res, template.html);
        } catch (error) {
          handleError(req, res, error);
        }
      }

      if (input.payload) {
        renderTemplate(JSON.parse(input.payload));
        return;
      }

      if (input.entityId) {
        const entity = Entity(await getConfig(slug));

        const entities = (await entity.entityList([input.entityId], 2)).map(row => row.doc);

        renderTemplate(entity.flattenValues(entities)[0]);
        return;
      }

      renderTemplate();
    })
  );

  router.post(
    '/email/subscribe.:ext?',
    asyncMiddleware(async (req, res) => {
      const email = Email(await getConfig(req.session.slug));

      try {
        handleResponse(req, res, await email.subscribe({
          email: req.body.email || req.query.email,
          name: req.body.name || req.query.name || '',
        }));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
