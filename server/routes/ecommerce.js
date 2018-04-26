const isArray = require('lodash/isArray');

module.exports = ({
  Ecommerce,
  router,
  authMiddleware,
  permissionMiddleware,
  asyncMiddleware,
  getConfig,
  handleResponse,
  handleError,
}) => {

  router.get(
    '/ecommerce/order/message/:message.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'ecommerce'),
    asyncMiddleware(async (req, res) => {
      const ecommerce = Ecommerce(await getConfig(req.session.slug));

      try {
        const order = await ecommerce.getOrder(req.query.orderId);
        handleResponse(req, res, order.messages[req.params.message].email.html);
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.get(
    '/ecommerce/:type.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'ecommerce'),
    asyncMiddleware(async (req, res) => {
      if (isArray(req.query.sort)) {
        req.query.sort = JSON.stringify(req.query.sort).replace(/\\"/g, '');
      }

      const ecommerce = Ecommerce(await getConfig(req.session.slug));

      try {
        handleResponse(req, res, await ecommerce.getType(req.params.type, req.query));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.post(
    '/ecommerce/:type.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'ecommerce'),
    asyncMiddleware(async (req, res) => {
      if (!/^(discount|order)$/.test(req.params.type)) {
        handleError(req, res, `Illegal type: ${req.params.type}`);
        return;
      }

      const ecommerce = Ecommerce(await getConfig(req.session.slug));

      try {
        handleResponse(req, res, await ecommerce.setType(req.params.type, req.body.item));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.delete(
    '/ecommerce/:type.:ext?',
    authMiddleware,
    permissionMiddleware.bind(null, 'ecommerce'),
    asyncMiddleware(async (req, res) => {
      if (!/^(discount)$/.test(req.params.type)) {
        handleError(req, res, `Illegal type: ${req.params.type}`);
        return;
      }

      const ecommerce = Ecommerce(await getConfig(req.session.slug));

      try {
        handleResponse(req, res, await ecommerce.deleteType(req.body.item));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );

  router.get(
    '/ecommerce/discount/:code.:ext?',
    asyncMiddleware(async (req, res) => {
      const ecommerce = Ecommerce(await getConfig(req.session.slug));

      try {
        handleResponse(req, res, await ecommerce.verifyDiscount(req.params.code));
      } catch (error) {
        handleError(req, res, error);
      }
    })
  );
};
