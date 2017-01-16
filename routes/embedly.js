const Embedly = require('../lib/embedly');

module.exports = (config) => {
  const embedly = new Embedly(config);

  config._router.get('/embedly/oembed.:ext?', config._ensureAuthenticated, (req, res) => {
    embedly.oembed(req.query.url || req.query.urls)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });
};
