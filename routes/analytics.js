const Analytics = require('../lib/analytics');

module.exports = (config) => {
  const analytics = new Analytics(config);

  config._router.get('/analytics.:ext?', config._ensureAuthenticated, config._useCachedResponse, (req, res) => {
    analytics.get(req.query)
      .then(config._cacheAndSendResponse.bind(null, req, res), config._handleError.bind(null, res));
  });
};
