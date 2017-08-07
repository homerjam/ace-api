const _ = require('lodash');
const Promise = require('bluebird');
const Auth = require('./auth');
const Db = require('./db');
const Helpers = require('./helpers');

const TYPES = ['user', 'schema', 'field', 'action', 'taxonomy'];

class Admin {
  constructor(config) {
    this.config = config;

    this.auth = new Auth(config);
  }

  static get TYPES() {
    return TYPES;
  }

  _isSuperUser(userId) {
    return this.config.auth.superUserId ? this.config.auth.superUserId.split(',').map(superUser => superUser.trim()).indexOf(userId) > -1 : false;
  }

  _getUser(userId, user = {}) {
    return {
      _id: userId,
      email: userId,
      firstName: user.firstName || (this.config.environment !== 'production' ? this.config.dev.role : null) || user.role || 'guest',
      lastName: user.lastName || 'user',
      role: (this.config.environment !== 'production' ? this.config.dev.role : null) || (this._isSuperUser(userId) ? 'super' : null) || user.role || 'guest',
      active: user.active !== undefined ? user.active : true,
      trashed: user.trashed !== undefined ? user.trashed : false,
      type: 'user',
    };
  }

  getUser(userId) {
    return new Promise((resolve, reject) => {

      Db.connect(this.config).getAsync(userId)
        .then((user) => {
          resolve(this._getUser(userId, user));

        }, (error) => {
          if (this._isSuperUser(userId) || this.config.environment !== 'production') {
            resolve(this._getUser(userId));
            return;
          }

          reject(error);
        });
    });
  }

  search(type, query) {
    return new Promise((resolve, reject) => {
      query.sort = _.isString(query.sort) ? `"${query.sort}"` : query.sort;

      Db.connect(this.config).searchAsync('admin', `${type}ByKey`, query)
        .then(resolve, reject);
    });
  }

  list(type, query) {
    return new Promise((resolve, reject) => {
      Db.connect(this.config).viewWithListAsync('admin', `${type}ByKey`, 'sort', query)
        .then(resolve, reject);
    });
  }

  create(type, item) {
    return new Promise((resolve, reject) => {
      item = _.omitBy(item, (value, key) => key[0] === '_');

      item._id = `${type}.${item.slug}`;
      item.type = type;
      item.trashed = false;

      if (type === 'user') {
        this.auth.addUser({
          email: item.email,
          slug: item.slug,
        })
          .then(() => {
            item._id = item.email;
            item.type = type;

            Helpers.createOrUpdate(this.config, item)
              .then(resolve, reject);
          }, reject);

      } else if (type === 'schema') {
        this.createOrUpdateIndex()
          .then(() => {
            Helpers.createOrUpdate(this.config, item)
              .then(resolve, reject);
          }, reject);

      } else {
        Helpers.createOrUpdate(this.config, item)
          .then(resolve, reject);
      }
    });
  }

  read(type, query) {
    return new Promise((resolve, reject) => {
      Db.connect(this.config).viewAsync('admin', `${type}ByKey`, query)
        .then(resolve, reject);
    });
  }

  update(type, items) {
    return new Promise((resolve, reject) => {
      items = items.map((item) => {
        item.type = type;
        return item;
      });

      if (type === 'schema') {
        this.createOrUpdateIndex()
          .then(() => {
            Helpers.chunkUpdate(this.config, items, 1000)
              .then(resolve, reject);
          });

      } else {
        Helpers.chunkUpdate(this.config, items, 1000)
          .then(resolve, reject);
      }
    });
  }

  delete(type, items) {
    return new Promise((resolve, reject) => {
      if (/field|action/.test(type)) {
        const fnMap = {
          field: 'removeFieldsFromSchemas',
          action: 'removeActionsFromSchemas',
        };

        this[fnMap[type]](items)
          .then(() => {
            items = items.map((item) => {
              item.trashed = true; return item;
            });
            Helpers.chunkUpdate(this.config, items, 1000)
              .then(resolve, reject);
          }, reject);

      } else {
        items = items.map((item) => {
          item.trashed = true; return item;
        });
        Helpers.chunkUpdate(this.config, items, 1000)
          .then(resolve, reject);
      }
    });
  }

  createOrUpdateIndex() {
    return new Promise((resolve, reject) => {
      Db.connect(this.config).viewAsync('admin', 'fieldByKey', {
        include_docs: true,
      })
        .then((body) => {
          const fields = body.rows.map(row => row.doc);

          const index = {
            name: 'entity',
            type: 'text',
            ddoc: 'entityIndex',
            index: {
              default_field: {
                enabled: true,
                analyzer: 'standard',
              },
              selector: {
                $and: [
                  {
                    type: 'entity',
                  },
                  {
                    $or: [
                      {
                        trashed: false,
                      },
                      {
                        trashed: { $exists: false },
                      },
                    ],
                  },
                ],
              },
              fields: [{
                name: 'title',
                type: 'string',
              }, {
                name: 'slug',
                type: 'string',
              }, {
                name: 'schema',
                type: 'string',
              }, {
                name: 'modified',
                type: 'string',
              }, {
                name: 'publishedAt',
                type: 'string',
              }],
            },
          };

          fields.forEach((field) => {
            let type;

            if (/number/.test(field.fieldType)) {
              type = 'number';

            } else if (/date|text/.test(field.fieldType)) {
              type = 'string';

            } else if (/checkbox/.test(field.fieldType)) {
              type = 'boolean';

            } else {
              return;
            }

            index.index.fields.push({
              name: `fields.${field.slug}.value`,
              type,
            });
          });

          Db.connect(this.config).indexAsync(index)
            .then(resolve, reject);
        }, reject);
    });
  }

  removeFieldsFromSchemas(fields) {
    return new Promise((resolve, reject) => {
      const schemaIds = [];

      const fieldSlugs = fields.map((field) => {
        field._schemas.forEach((schema) => {
          const schemaId = `schema.${schema.slug}`;

          if (schemaIds.indexOf(schemaId) === -1) {
            schemaIds.push(schemaId);
          }
        });

        delete field._schemas;

        return field.slug;
      });

      Db.connect(this.config).fetchAsync({
        keys: schemaIds,
        include_docs: true,
      })
        .then((body) => {
          const schemas = body.rows.map((row) => {
            const schema = row.doc;

            schema.fields = schema.fields.filter(field => fieldSlugs.indexOf(field.slug) === -1);

            schema.sortFields = schema.sortFields.filter(fieldSlug => fieldSlugs.indexOf(fieldSlug) === -1);

            return schema;
          });

          Helpers.chunkUpdate(this.config, schemas, 1000)
            .then(resolve, reject);
        }, reject);
    });
  }

  removeActionsFromSchemas(actions) {
    return new Promise((resolve, reject) => {
      const schemaIds = [];

      const actionSlugs = actions.map((action) => {
        action._schemas.forEach((schema) => {
          const schemaId = `schema.${schema.slug}`;

          if (schemaIds.indexOf(schemaId) === -1) {
            schemaIds.push(schemaId);
          }
        });

        delete action._schemas;

        return action.slug;
      });

      Db.connect(this.config).fetchAsync({
        keys: schemaIds,
        include_docs: true,
      })
        .then((response) => {
          const schemas = response.rows.map((row) => {
            const schema = row.doc;

            schema.actions = schema.actions.filter(action => actionSlugs.indexOf(action.slug) === -1);

            return schema;
          });

          Helpers.chunkUpdate(this.config, schemas, 1000)
            .then(resolve, reject);
        }, reject);
    });
  }

}

module.exports = Admin;
