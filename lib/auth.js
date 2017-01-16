const _ = require('lodash');
const Promise = require('bluebird');
const Cloudant = require('cloudant');
const request = require('request-promise');
const roles = require('./roles');
const Settings = require('./settings');

const providerTokenUri = {
  instagram: 'https://api.instagram.com/oauth/access_token',
  stripe: 'https://connect.stripe.com/oauth/token',
  vimeo: 'https://api.vimeo.com/oauth/access_token',
};

class Auth {
  constructor(db, config) {
    this.config = config;

    this.db = db || ((dbname) => {
      const cloudant = new Cloudant({
        url: config.db.url,
      });

      const db = Promise.promisifyAll(cloudant.use(dbname));

      return db;
    });

    this.authDb = () => {
      const cloudant = new Cloudant({
        url: config.db.url,
      });

      const authDb = Promise.promisifyAll(cloudant.use(config.auth.dbName));

      return authDb;
    };
  }

  static requirePermission(permission, req, res, next) {
    if (!req.session.role || (!roles[req.session.role].permissions[permission] && !req.session.superUser)) {
      res.status(401).send({
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

      this.authDb().insertAsync(user)
        .then(resolve, (error) => {
          if (error.statusCode !== 409) {
            reject(error);
            return;
          }

          this.authDb().getAsync(user._id)
            .then((response) => {
              user._rev = response._rev;

              this.authDb().insertAsync(user)
                .then(resolve, reject);
            });
        });
    });
  }

  authoriseUser(email, req) {
    return new Promise((resolve, reject) => {
      const superUsers = this.config.auth.superUserId.split(',').map(superUser => superUser.trim());

      if (superUsers.indexOf(email) > -1) {
        if (req && req.session) {
          if (!req.session.email) {
            req.session.email = email;
          }

          req.session.role = 'admin';
          req.session.superUser = true;

          req.session.userAuthorised = true;
        }

        resolve({
          email,
          role: 'admin',
          superUser: true,
        });
        return;
      }

      this.authDb().viewAsync('user', 'byKey', {
        key: email,
        include_docs: true,
      })
        .then((response) => {
          if (response.rows.length === 0) {
            reject(`User not found (${email})`);
            return;
          }

          const authUser = response.rows[0].doc;
          const slug = authUser.slug;

          this.db(slug).viewAsync('admin', 'userByKey', {
            key: email,
            include_docs: true,
          })
            .then((response) => {
              if (response.rows.length === 0) {
                reject(`User not found (${email})`);
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

              if (req && req.session) {
                if (!req.session.email) {
                  req.session.email = email;
                }

                if (!req.session.slug) {
                  req.session.slug = slug;
                }

                req.session.role = user.role;
                req.session.superUser = false;

                req.session.userAuthorised = true;
              }

              resolve({
                email,
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

          const settings = new Settings(this.db);

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
