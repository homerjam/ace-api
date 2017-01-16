const Email = require('../lib/email');

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
   * @apiParam {boolean} previewOnly=false Preview only (disable inlining of styles etc)
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
    let data = Object.keys(req.body).length ? req.body : req.query || {};

    if (data.payload) {
      data = JSON.parse(data.payload);
    }

    const options = {
      previewOnly: req.query.previewOnly ? JSON.parse(req.query.previewOnly) : false,
      skipValidation: req.query.skipValidation ? JSON.parse(req.query.skipValidation) : false,
    };

    email.getTemplate(req.params.templateSlug, data, options)
      .then((template) => {
        config._sendResponse(res, template.html);
      }, config._handleError.bind(null, res));
  });

  config._router.post('/email/subscribe.:ext?', (req, res) => {
    email.subscribe({
      email: req.body.email || req.query.email,
      name: req.body.name || req.query.name || '',
    })
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });
};
