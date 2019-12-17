module.exports = ({
  Ecommerce,
  Email,
  Stripe,
  router,
  authMiddleware,
  permissionMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {
  router.all(
    '/stripe/checkout.:ext?',
    asyncMiddleware(async (req, res) => {
      const token = req.body.token || JSON.parse(req.query.token);
      const order = req.body.order || JSON.parse(req.query.order);

      const stripe = Stripe(await getConfig(req.session.slug));

      try {
        handleResponse(req, res, await stripe.checkout(token, order));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.post(
    '/stripe/refund.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'ecommerce'),
    asyncMiddleware(async (req, res) => {
      const order = req.body.order || JSON.parse(req.query.order);
      const amount = Number(req.body.amount || req.query.amount || 0) * 100;

      const stripe = Stripe(await getConfig(req.session.slug));

      try {
        handleResponse(req, res, await stripe.refund(order, amount));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.get(
    '/stripe/account.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'ecommerce'),
    asyncMiddleware(async (req, res) => {
      const stripe = Stripe(await getConfig(req.session.slug));

      try {
        handleResponse(req, res, await stripe.retrieveAccount());
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.get(
    '/stripe/email.:ext?',
    asyncMiddleware(async (req, res) => {
      const config = await getConfig(req.session.slug);
      const email = Email(config);
      const stripe = Stripe(config);
      const ecommerce = Ecommerce(config);

      const settings = await stripe.getSettings();
      const order = await ecommerce.getOrder(req.query.orderId);

      const data = {
        settings,
        order,
      };

      const template = await email.getTemplate(
        `${req.session.slug}/${req.query.template}`,
        data
      );

      try {
        handleResponse(req, res, template.html);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
