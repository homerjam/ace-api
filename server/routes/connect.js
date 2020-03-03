const grant = require('grant-express');

module.exports = async ({ app, getConfig }) => {
  const config = await getConfig();

  app.all('/connect*', (req, res, next) => {
    grant({
      defaults: {
        protocol: req.protocol,
        host: req.get('Host'),
        // transport: 'session',
        // state: true,
      },
      google: {
        key: config.provider.google.clientId,
        secret: config.provider.google.clientSecret,
        scope: ['openid', 'profile', 'email'],
        nonce: true,
        custom_params: { access_type: 'offline', referer: req.get('Referer') },
        callback: config.cms.url + '/connect',
      },
    })(req, res, next);
  });
};
