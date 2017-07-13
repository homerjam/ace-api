const _ = require('lodash');
const Promise = require('bluebird');
const request = require('request-promise');
const Db = require('./db');
const Settings = require('./settings');
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
    if (req.session.role === 'super') {
      next();
      return;
    }

    if (!req.session.role || !roles[req.session.role] || roles[req.session.role].permissions[permission] !== true) {
      res.status(401);
      res.send({
        permission,
        message: "Sorry, you're not authorised to do this.",
      });
      return;
    }

    next();
  }

  addUser(user) {
    return new Promise((resolve, reject) => {
      user._id = user.email;
      user.type = 'user';

      Db.connect(this.config, this.config.auth.dbName).insertAsync(user)
        .then(resolve, (error) => {
          if (error.statusCode !== 409) {
            reject(error);
            return;
          }

          Db.connect(this.config, this.config.auth.dbName).getAsync(user._id)
            .then((response) => {
              user._rev = response._rev;

              Db.connect(this.config, this.config.auth.dbName).insertAsync(user)
                .then(resolve, reject);
            });
        });
    });
  }

  authoriseUser(userId) {
    return new Promise((resolve, reject) => {
      const isSuperUser = this.config.auth.superUserId.split(',').map(superUser => superUser.trim()).indexOf(userId) > -1;

      if (isSuperUser) {
        resolve({
          userId,
          role: 'super',
        });
        return;
      }

      Db.connect(this.config, this.config.auth.dbName).viewAsync('user', 'byKey', {
        key: userId,
        include_docs: true,
      })
        .then((response) => {
          if (response.rows.length === 0) {
            reject(`User not found (${userId})`);
            return;
          }

          const authUser = response.rows[0].doc;
          const slug = authUser.slug;

          Db.connect(this.config, slug).viewAsync('admin', 'userByKey', {
            key: userId,
            include_docs: true,
          })
            .then((response) => {
              if (response.rows.length === 0) {
                reject(`User not found (${userId})`);
                return;
              }

              const user = response.rows[0].doc;

              if (!user.active) {
                reject('Not authorised (inactive)');
                return;
              }

              if (user.trashed) {
                reject('Not authorised (removed)');
                return;
              }

              resolve({
                userId,
                slug,
                role: user.role,
              });
            }, reject);
        }, reject);
    });
  }

  authenticateWithProvider(provider, params) {
    return new Promise((resolve, reject) => {
      request({
        method: 'POST',
        uri: providerTokenUri[provider],
        form: {
          grant_type: 'authorization_code',
          client_id: params.clientId || this.config[provider].clientId,
          client_secret: params.clientSecret || this.config[provider].clientSecret,
          redirect_uri: params.redirectUri || this.config[provider].redirectUri,
          code: params.code,
        },
      })
        .then((response) => {
          const result = JSON.parse(response);

          if (result.error) {
            reject(result.error);
            return;
          }

          const settings = new Settings(this.config);

          settings.settings()
            .then((settingsObj) => {
              settingsObj[provider] = _.extend(settingsObj[provider], result);

              settings.settings(settingsObj)
                .then(() => {
                  resolve(result);
                }, reject);
            }, reject);
        }, reject);
    });
  }

}

module.exports = Auth;
