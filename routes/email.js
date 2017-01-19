const Email = require('../lib/email');
const Entity = require('../lib/entity');

module.exports = (config) => {
  const email = new Email(config);

  /**
   * @api {get} /email/template/:templateSlug Render template
   * @apiName RenderTemplate
   * @apiGroup Email
   * @apiPermission none
   *
   * @apiDescription Render email template. You can also use POST to send data to the template.
   *
   * @apiExample Example POST Request Body
   *  {
   *    "payload": <json>
   *  }
   *
   * @apiParam {string} entityId Entity `id` from which to render the template
   * @apiParam {boolean} data=false Data mode, show locals available within templates
   * @apiParam {boolean} preview=false Preview mode (disable inlining of styles etc)
   * @apiParam {boolean} skipValidation=false Skip MJML validation
   *
   * @apiError (Error 500) TemplateErrors
   * @apiErrorExample {json} Response
   *  {
   *    "errors": [],
   *    "html": ""
   *  }
   */
  config._router.all('/email/template/:templateSlug.:ext?', (req, res) => {
    const input = Object.keys(req.body).length ? req.body : req.query || {};

    const options = {
      preview: input.preview ? JSON.parse(input.preview) : false,
      data: input.data ? JSON.parse(input.data) : false,
      skipValidation: input.skipValidation ? JSON.parse(input.skipValidation) : false,
    };

    function renderTemplate(data = {}) {
      if (options.data) {
        config._sendResponse(res, data);
        return;
      }

      email.getTemplate(req.params.templateSlug, data, options)
        .then((template) => {
          config._sendResponse(res, template.html);
        }, config._handleError.bind(null, res));
    }

    if (input.payload) {
      renderTemplate(JSON.parse(input.payload));
      return;
    }

    if (input.entityId) {
      const entity = new Entity(config._db.bind(null, req));

      entity.entitiesById([input.entityId], true, false, true)
        .then((entities) => {
          entities = Entity.flattenValues(entities);

          renderTemplate(entities[0]);
        });

      return;
    }

    renderTemplate();
  });

  config._router.post('/email/subscribe.:ext?', (req, res) => {
    email.subscribe({
      email: req.body.email || req.query.email,
      name: req.body.name || req.query.name || '',
    })
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });
};
