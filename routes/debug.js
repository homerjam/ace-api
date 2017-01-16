const expressUseragent = require('express-useragent');

module.exports = (config) => {

  const useragent = expressUseragent.express();

  config._router.all('/debug/useragent.:ext?', useragent, (req, res) => {
    res.status(200).send(`<html><head><title>${req.useragent.source}</title><meta name="description" content="${req.useragent.source}"></head><body>${req.useragent.source}</body></html>`);
  });

};
