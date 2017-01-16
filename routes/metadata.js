const Settings = require('../lib/settings');

module.exports = (config) => {

  config._router.get('/metadata.:ext?', config._useCachedResponse, (req, res) => {
    const settings = new Settings(config._db.bind(null, req));

    settings.settings()
      .then((settings) => {
        config._cacheAndSendResponse(req, res, settings.metadata);
      }, config._handleError.bind(null, res));
  });

};
