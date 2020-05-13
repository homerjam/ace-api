const grant = require('grant-express');

module.exports = async ({ router, getAppConfig }) => {
  const appConfig = await getAppConfig();

  router.all('/connect*', (req, res, next) => {
    grant({
      defaults: {
        origin: req.protocol + '://' + req.get('Host'),
        // transport: 'session',
        // state: true,
      },
      google: {
        key: appConfig.provider.google.clientId,
        secret: appConfig.provider.google.clientSecret,
        scope: ['openid', 'profile', 'email'],
        nonce: true,
        custom_params: { access_type: 'offline' },
        callback: appConfig.cms.url + '/connect',
      },
      instagram: {
        key: appConfig.provider.instagram.clientId,
        secret: appConfig.provider.instagram.clientSecret,
        scope: ['basic'],
        nonce: true,
        callback: appConfig.cms.url + '/connect',
      },
      spotify: {
        key: appConfig.provider.spotify.clientId,
        secret: appConfig.provider.spotify.clientSecret,
        scope: [
          'user-read-email',
          'user-top-read',
          'user-read-recently-played',
        ],
        nonce: true,
        callback: appConfig.cms.url + '/connect',
      },
      vimeo: {
        key: appConfig.provider.vimeo.clientId,
        secret: appConfig.provider.vimeo.clientSecret,
        scope: ['public', 'private', 'video_files'],
        nonce: true,
        callback: appConfig.cms.url + '/connect',
      },
    })(req, res, next);
  });
};
