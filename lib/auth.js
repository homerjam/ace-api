const _ = require('lodash');
const querystring = require('querystring');
const axios = require('axios');
const expressJwt = require('express-jwt');
const jwks = require('jwks-rsa');
const AuthenticationClient = require('auth0').AuthenticationClient;
const ClientConfig = require('./client-config');
const Db = require('./db');
const Jwt = require('./jwt');
const ErrorCode = require('./error-code');

const providerTokenUri = {
  google: 'https://www.googleapis.com/oauth2/v4/token',
  instagram: 'https://api.instagram.com/oauth/access_token',
  vimeo: 'https://api.vimeo.com/oauth/access_token',
  spotify: 'https://accounts.spotify.com/api/token',
};

class Auth {
  constructor(config) {
    this.config = config;

    this.jwtCheck = expressJwt({
      secret: jwks.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri:
          'https://' + this.config.auth0.domain + '/.well-known/jwks.json',
      }),
      audience: this.config.auth0.audience,
      issuer: 'https://' + this.config.auth0.domain + '/',
      algorithms: ['RS256'],
    });
  }

  async authUser(slug, accessToken) {
    const auth0 = new AuthenticationClient({
      domain: this.config.auth0.domain,
    });

    const auth0Profile = await auth0.getProfile(accessToken);

    const userId = auth0Profile.email;

    const isSuperUser =
      _.get(this.config, 'auth.superUserId', '')
        .split(',')
        .map(superUser => superUser.trim())
        .indexOf(userId) > -1;

    let user;

    if (isSuperUser) {
      user = {
        active: true,
        role: 'super',
      };
    } else {
      try {
        const clientConfig = await Db.connect(this.config, slug).get('config');

        user = _.find(
          clientConfig.users,
          user => user.email.toLowerCase() === userId.toLowerCase()
        );
      } catch (error) {
        throw new ErrorCode(404, `Database not found: ${slug}`);
      }
    }

    if (!user) {
      throw new ErrorCode(401, `User not found: ${userId}`);
    }

    if (!user.active) {
      throw new ErrorCode(401, `User not active: ${userId}`);
    }

    const payload = {
      slug,
      userId,
      active: user.active,
      role: user.role,
    };

    const jwt = new Jwt(this.config);

    const apiToken = jwt.signToken(payload, {
      // expiresIn: 7200,
    });

    return { ...payload, apiToken };
  }

  async authProvider(provider, params = {}, userId = null, refresh = false) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    const providerConfig = _.merge(
      {},
      this.config.provider[provider],
      params || {}
    );

    let providerClientConfig;

    if (userId) {
      providerClientConfig = _.get(clientConfig, [
        'userSettings',
        userId,
        'provider',
        provider,
      ]);
    } else {
      providerClientConfig = _.get(clientConfig, ['provider', provider]);
    }

    if (!providerClientConfig) {
      providerClientConfig = {};
    }

    const data = {
      grant_type: refresh ? 'refresh_token' : 'authorization_code',
      code: params && params.code ? params.code : undefined,
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      redirect_uri: providerConfig.redirectUri,
      refresh_token: refresh ? providerClientConfig.refresh_token : undefined,
    };

    const uri = providerTokenUri[provider];

    let providerAuth;

    try {
      providerAuth = (await axios.post(uri, querystring.stringify(data))).data;
    } catch (error) {
      throw Error(JSON.stringify(error.response.data));
    }

    providerClientConfig = _.merge({}, providerClientConfig, providerAuth);
    providerClientConfig.begins = Math.floor(new Date().getTime() / 1000);

    if (provider === 'google') {
      try {
        providerClientConfig.user = (
          await axios.get(
            `https://www.googleapis.com/plus/v1/people/me?access_token=${providerClientConfig.access_token}`
          )
        ).data;
      } catch (error) {
        console.error(error);
      }
    }

    if (provider === 'spotify') {
      try {
        providerClientConfig.user = (
          await axios.get(
            `https://api.spotify.com/v1/me?access_token=${providerClientConfig.access_token}`
          )
        ).data;
      } catch (error) {
        console.error(error);
      }
    }

    if (userId) {
      _.set(
        clientConfig,
        ['userSettings', userId, 'provider', provider],
        providerClientConfig
      );
    } else {
      _.set(clientConfig, ['provider', provider], providerClientConfig);
    }

    return cc.set(clientConfig);
  }
}

module.exports = Auth;
