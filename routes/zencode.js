const Zencode = require('../lib/zencode');

module.exports = (config) => {

  config._router.get('/zencode/job.:ext?', config._ensureAuthenticated, (req, res) => {
    const zencode = new Zencode(config._db.bind(null, req), config);

    zencode.getJob(req.query.id)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

};
