const _ = require('lodash');
const querystring = require('querystring');
const axios = require('axios');
const ClientConfig = require('./client-config');
const Db = require('./user');
const roles = require('./roles');

const providerTokenUri = {
  instagram: 'https://api.instagram.com/oauth/access_token',
  stripe: 'https://connect.stripe.com/oauth/token',
  vimeo: 'https://api.vimeo.com/oauth/access_token',
};

class Auth {
  constructor(config) {
    this.config = config;
  }

  static requirePermission(permission, req, res, next) {
    if (!req.session.role) {
      res.status(401);
      res.send({
        permission,
        message: 'Error: role not defined.',
      });
      return;
    }

    if (req.session.role === 'super') {
      next();
      return;
    }

    if (!roles[req.session.role] || roles[req.session.role].permissions[permission] !== true) {
      res.status(401);
      res.send({
        permission,
        message: 'Sorry, you\'re not authorised to do this.',
      });
      return;
    }

    next();
  }

  async authoriseUser(slug, userId) {
    const isSuperUser = this.config.auth.superUserId.split(',').map(superUser => superUser.trim()).indexOf(userId) > -1;

    if (isSuperUser) {
      return {
        id: userId,
        role: 'super',
      };
    }

    const clientConfig = await Db.connect(this.config, slug).getAsync('config');

    const user = _.find(clientConfig.users, { id: userId });

    if (!user) {
      throw Error(`User not found: ${userId}`);
    }

    if (!user.active) {
      throw Error(`User not active: ${userId}`);
    }

    return user;
  }

  async authenticateWithProvider(provider, params) {
    const data = {
      grant_type: 'authorization_code',
      client_id: params.clientId || this.config[provider].clientId,
      client_secret: params.clientSecret || this.config[provider].clientSecret,
      redirect_uri: params.redirectUri || this.config[provider].redirectUri,
      code: params.code,
    };

    let response;

    try {
      response = await axios.post(providerTokenUri[provider], querystring.stringify(data));
    } catch (error) {
      throw new Error(JSON.stringify(error.response.data));
    }

    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    clientConfig.provider[provider] = response.data;

    return cc.set(clientConfig);
  }

}

module.exports = Auth;
