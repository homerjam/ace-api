const Auth = require('../lib/auth');

module.exports = (config) => {

  config._router.get('/auth/:provider/config.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'settings'), (req, res) => {
    res.status(config[req.params.provider] ? 200 : 404);
    res.json(config[req.params.provider] || {});
  });

  config._router.get('/auth/:provider.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'settings'), (req, res) => {
    res.status(req.query.error ? 500 : 200);
    res.send(`${(req.query.error_description ? req.query.error_description : 'Successfully authenticated')} (${req.params.provider})`);
  });

  config._router.post('/auth/:provider.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'settings'), (req, res) => {
    const auth = new Auth(config._db.bind(null, req), config);

    auth.authenticateWithProvider(req.params.provider, req.body)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

};
