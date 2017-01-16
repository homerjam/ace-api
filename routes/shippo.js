const Shippo = require('../lib/shippo');

module.exports = (config) => {
  const shippo = new Shippo(config);

  config._router.all('/shippo/quote.:ext?', (req, res) => {
    const address = req.body.address || JSON.parse(req.params.address);
    const parcel = req.body.parcel || JSON.parse(req.params.parcel);

    shippo.getQuote(address, parcel)
      .then(config._cacheAndSendResponse.bind(null, req, res), config._handleError.bind(null, res));
  });
};
