const grant = require('grant-express');

module.exports = async ({ app, getConfig }) => {
  const config = await getConfig();

  app.all('/connect*', (req, res, next) => {
    grant({
      defaults: {
        origin: req.protocol + '://' + req.get('Host'),
        // transport: 'session',
        // state: true,
      },
      google: {
        key: config.provider.google.clientId,
        secret: config.provider.google.clientSecret,
        scope: ['openid', 'profile', 'email'],
        nonce: true,
        custom_params: { access_type: 'offline' },
        callback: config.cms.url + '/connect',
      },
      instagram: {
        key: config.provider.instagram.clientId,
        secret: config.provider.instagram.clientSecret,
        scope: ['basic'],
        nonce: true,
        callback: config.cms.url + '/connect',
      },
      spotify: {
        key: config.provider.spotify.clientId,
        secret: config.provider.spotify.clientSecret,
        scope: [
          'user-read-email',
          'user-top-read',
          'user-read-recently-played',
        ],
        nonce: true,
        callback: config.cms.url + '/connect',
      },
      vimeo: {
        key: config.provider.vimeo.clientId,
        secret: config.provider.vimeo.clientSecret,
        scope: ['public', 'private', 'video_files'],
        nonce: true,
        callback: config.cms.url + '/connect',
      },
    })(req, res, next);
  });
};
