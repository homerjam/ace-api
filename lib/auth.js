const _ = require('lodash');
const querystring = require('querystring');
const axios = require('axios');
const ClientConfig = require('./client-config');
const Db = require('./db');

const providerTokenUri = {
  google: 'https://www.googleapis.com/oauth2/v4/token',
  instagram: 'https://api.instagram.com/oauth/access_token',
  stripe: 'https://connect.stripe.com/oauth/token',
  vimeo: 'https://api.vimeo.com/oauth/access_token',
};

class Auth {
  constructor(config) {
    this.config = config;
  }

  async authoriseUser(slug, userId) {
    const isSuperUser = this.config.auth.superUserId.split(',').map(superUser => superUser.trim()).indexOf(userId) > -1;

    if (isSuperUser) {
      return {
        id: userId,
        role: 'super',
      };
    }

    const clientConfig = await Db.connect(this.config, slug).get('config');

    const user = _.find(clientConfig.users, { id: userId });

    if (!user) {
      throw Error(`User not found: ${userId}`);
    }

    if (!user.active) {
      throw Error(`User not active: ${userId}`);
    }

    return user;
  }

  async authenticateWithProvider(provider, params, refresh = false) {
    const providerConfig = _.merge({}, this.config[provider], params);

    const data = {
      grant_type: refresh ? 'refresh_token' : 'authorization_code',
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
      redirect_uri: providerConfig.redirectUri,
      code: params.code,
      refresh_token: params.refresh_token,
    };

    const uri = providerTokenUri[provider];

    let response;
    try {
      response = await axios.post(uri, querystring.stringify(data));
    } catch (error) {
      throw new Error(error.response.data.error_description);
    }

    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    if (!clientConfig.provider) {
      clientConfig.provider = {};
    }

    const providerClientConfig = _.merge({}, clientConfig.provider[provider] || {}, response.data);

    if (provider === 'google') {
      providerClientConfig.expires = providerClientConfig.expires_in + Math.floor(+new Date() / 1000);
      try {
        providerClientConfig.user = (await axios.get(`https://www.googleapis.com/plus/v1/people/me?access_token=${providerClientConfig.access_token}`)).data;
      } catch (error) {
        console.error(error);
      }
    }

    clientConfig.provider[provider] = providerClientConfig;

    return cc.set(clientConfig);
  }

}

module.exports = Auth;
