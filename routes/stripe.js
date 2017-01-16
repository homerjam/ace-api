const Auth = require('../lib/auth');
const Stripe = require('../lib/stripe');

module.exports = (config) => {

  config._router.all('/stripe/checkout.:ext?', (req, res) => {
    const token = req.body.token || JSON.parse(req.query.token);
    const order = req.body.order || JSON.parse(req.query.order);

    const stripe = new Stripe(config._db.bind(null, req), config);

    stripe.checkout(token, order)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.post('/stripe/refund.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'ecommerce'), (req, res) => {
    const order = req.body.order || JSON.parse(req.query.order);
    const amount = Number(req.body.amount || req.query.amount || 0) * 100;

    const stripe = new Stripe(config._db.bind(null, req), config);

    stripe.refund(order, amount)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.get('/stripe/settings.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'ecommerce'), (req, res) => {
    const stripe = new Stripe(config._db.bind(null, req), config);

    stripe.getSettings()
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.get('/stripe/account.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'ecommerce'), (req, res) => {
    const stripe = new Stripe(config._db.bind(null, req), config);

    stripe.retrieveAccount()
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

};
