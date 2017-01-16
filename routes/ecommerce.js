const _ = require('lodash');
const Auth = require('../lib/auth');
const Ecommerce = require('../lib/ecommerce');

module.exports = (config) => {

  config._router.get('/ecommerce/settings.:ext?', (req, res) => {
    const ecommerce = new Ecommerce(config._db.bind(null, req), config);

    ecommerce.settings()
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.put('/ecommerce/settings.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'ecommerce'), (req, res) => {
    const ecommerce = new Ecommerce(config._db.bind(null, req), config);

    ecommerce.settings(req.body.settings)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.get('/ecommerce/order/message/:message.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'ecommerce'), (req, res) => {
    const ecommerce = new Ecommerce(config._db.bind(null, req), config);

    ecommerce.getOrder(req.query.orderId)
      .then((order) => {
        try {
          res.status(200).send(order.messages[req.params.message].email.html);
        } catch (error) {
          config._handleError(res, error);
        }
      }, config._handleError.bind(null, res));
  });

  config._router.get('/ecommerce/:type.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'ecommerce'), (req, res) => {
    if (_.isArray(req.query.sort)) {
      req.query.sort = JSON.stringify(req.query.sort).replace(/\\"/g, '');
    }

    const ecommerce = new Ecommerce(config._db.bind(null, req), config);

    ecommerce.getType(req.params.type, req.query)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.post('/ecommerce/:type.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'ecommerce'), (req, res) => {
    if (!/discount|order/.test(req.params.type)) {
      config._handleError(res, `Illegal type: ${req.params.type}`);
      return;
    }

    const ecommerce = new Ecommerce(config._db.bind(null, req), config);

    ecommerce.setType(req.params.type, req.body.item)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.delete('/ecommerce/:type.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'ecommerce'), (req, res) => {
    if (!/discount/.test(req.params.type)) {
      config._handleError(res, `Illegal type: ${req.params.type}`);
      return;
    }

    const ecommerce = new Ecommerce(config._db.bind(null, req), config);

    ecommerce.deleteType(req.body.item)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.get('/ecommerce/discount/:code.:ext?', (req, res) => {
    const ecommerce = new Ecommerce(config._db.bind(null, req), config);

    ecommerce.verifyDiscount(req.params.code)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });
};
