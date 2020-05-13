const _ = require('lodash');

module.exports = ({
  Pdf,
  ClientConfig,
  router,
  asyncMiddleware,
  getAppConfig,
  handleError,
}) => {
  router.get(
    '/pdf/view.:ext?',
    asyncMiddleware(async (req, res) => {
      const pdf = Pdf(await getAppConfig(req.session));

      pdf
        .getPayload(req.query.template, req.query.id, req.session.role)
        .then((payload) => {
          pdf.getPdf(payload).then((pdf) => {
            res.type('application/pdf');
            res.status(200);
            res.send(pdf);
          }, handleError.bind(null, req, res));
        }, handleError.bind(null, req, res));
    })
  );

  router.get(
    '/pdf/download.:ext?',
    asyncMiddleware(async (req, res) => {
      const pdf = Pdf(await getAppConfig(req.session));

      pdf
        .getPayload(req.query.template, req.query.id, req.session.role)
        .then((payload) => {
          pdf.getPdf(payload).then((pdf) => {
            res.attachment(payload.fileName || 'download.pdf');
            res.status(200);
            res.send(pdf);
          }, handleError.bind(null, req, res));
        }, handleError.bind(null, req, res));
    })
  );

  router.get(
    '/pdf/payload.:ext?',
    asyncMiddleware(async (req, res) => {
      const pdf = Pdf(await getAppConfig(req.session));

      pdf
        .getPayload(req.query.template, req.query.id, req.session.role)
        .then((payload) => {
          res.status(200);
          res.json(payload);
        }, handleError.bind(null, req, res));
    })
  );

  router.get(
    '/pdf/submit.:ext?',
    asyncMiddleware(async (req, res) => {
      const appConfig = await getAppConfig(req.session);

      const clientConfig = await ClientConfig(appConfig).read();

      const assetSlug = _.get(clientConfig, 'assets.slug', req.session.slug);

      Pdf(appConfig)
        .getPayload(req.query.template, req.query.id, req.session.role)
        .then((payload) => {
          payload = JSON.stringify(payload).replace(/'/gi, '’');

          res.status(200);
          res.send(`
          <body onload='form.submit()'>
            <form id='form' method='POST' action='${appConfig.assist.url}/${assetSlug}/pdf/download' target='_self'>
              <input type='hidden' name='payload' value='${payload}' />
            </form>
          </body>
        `);
        }, handleError.bind(null, req, res));
    })
  );
};
