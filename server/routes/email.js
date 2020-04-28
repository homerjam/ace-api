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
   * /email/preview:
   *  get:
   *    tags:
   *      - email
   *    summary: Preview email template
   * #   description: Preview email template
   *    produces:
   *      - text/html
   *    parameters:
   *      - name: slug
   *        description: Slug (optionally override slug in development mode)
   *        in: query
   *        required: false
   *        type: string
   *      - name: templateSlug
   *        description: Template slug (folder name of the template)
   *        in: query
   *        required: true
   *        type: string
   *      - name: payload
   *        description: JSON payload from which to render the template
   *        in: query
   *        required: false
   *        type: string
   *      - name: entityId
   *        description: Entity `_id` from which to render the template
   *        in: query
   *        required: false
   *        type: string
   *      - name: inlineStyles
   *        description: Inline CSS
   *        in: query
   *        required: false
   *        type: boolean
   *        default: true
   *    responses:
   *      200:
   *        description: Template
   */
  router.all(
    '/email/preview.:ext?',
    asyncMiddleware(async (req, res) => {
      const input = Object.keys(req.body).length ? req.body : req.query || {};

      const templateOptions = {
        data: input.data ? JSON.parse(input.data) : false,
        inlineStyles: input.inlineStyles
          ? JSON.parse(input.inlineStyles)
          : true,
        inky: input.inky ? JSON.parse(input.inky) : false,
        mjml: input.mjml ? JSON.parse(input.mjml) : false,
        skipValidation: input.skipValidation
          ? JSON.parse(input.skipValidation)
          : false,
      };

      const slug = input.slug || req.session.slug;

      // if (!slug) {
      //   throw Error('Missing `slug` parameter');
      // }

      async function renderTemplate(data = {}) {
        if (templateOptions.data) {
          handleResponse(req, res, data);
          return;
        }

        const email = Email(await getConfig({ slug }));

        try {
          const template = await email.getTemplate(
            input.templateSlug,
            data,
            templateOptions
          );

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
        const entity = Entity(await getConfig({ slug }));

        const entities = (
          await entity.entityList([input.entityId], { children: 2 })
        ).map((row) => row.doc);

        renderTemplate(Entity.flattenValues(entities)[0]);
        return;
      }

      renderTemplate();
    })
  );

  router.all(
    '/email/send.:ext?',
    asyncMiddleware(async (req, res) => {
      const input = Object.keys(req.body).length ? req.body : req.query || {};

      const templateOptions = {
        inlineStyles: input.inlineStyles
          ? JSON.parse(input.inlineStyles)
          : true,
        inky: input.inky ? JSON.parse(input.inky) : false,
        mjml: input.mjml ? JSON.parse(input.mjml) : false,
        skipValidation: input.skipValidation
          ? JSON.parse(input.skipValidation)
          : true,
      };

      const emailOptions = {
        fromName: input.fromName || '',
        fromEmail: input.fromEmail,
        toName: input.toName || '',
        toEmail: input.toEmail,
        from: `${input.fromName || ''} <${input.fromEmail}>`,
        to: input.toEmail,
        subject: input.subject,
      };

      const slug = input.slug || req.session.slug;

      const email = Email(await getConfig({ slug }));

      try {
        const result = await email.sendEmail(
          emailOptions,
          input.templateSlug,
          input.payload,
          templateOptions
        );

        handleResponse(req, res, result);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.post(
    '/email/subscribe.:ext?',
    asyncMiddleware(async (req, res) => {
      const email = Email(await getConfig(req.session));

      try {
        handleResponse(
          req,
          res,
          await email.subscribe({
            email: req.body.email || req.query.email,
            name: req.body.name || req.query.name || '',
          })
        );
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
