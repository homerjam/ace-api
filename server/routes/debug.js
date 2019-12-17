module.exports = ({ router }) => {
  router.all('/debug/useragent.:ext?', (req, res) => {
    const expressUseragent = require('express-useragent');
    const useragent = expressUseragent.parse(req.headers['user-agent']);

    res.status(200);
    res.send(`
      <html>
        <head>
          <title>${useragent.source}</title>
          <meta name="description" content="${useragent.source}">
        </head>
        <body>${useragent.source}</body>
      </html>
    `);
  });
};
