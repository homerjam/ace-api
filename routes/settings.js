const Auth = require('../lib/auth');
const Settings = require('../lib/settings');

module.exports = (config) => {

  config._router.get('/settings.:ext?', config._ensureAuthenticated, (req, res) => {
    const settings = new Settings(config._db.bind(null, req));

    settings.settings()
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.put('/settings.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'settings'), (req, res) => {
    const settings = new Settings(config._db.bind(null, req));

    settings.settings(req.body.settings, req.session.email)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

};
