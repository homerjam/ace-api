const _ = require('lodash');
const Promise = require('bluebird');

const Auth = require('./auth');
const Helpers = require('./helpers');

class Admin {
  constructor(db, config) {
    this.db = db;
    this.config = config;

    this.auth = new Auth(db, config);
  }

  getUser(userId, isSuperUser) {
    return new Promise((resolve, reject) => {
      this.db().getAsync(userId)
        .then((body) => {
          let user = body;

          if (isSuperUser) {
            user = {
              _id: userId,
              active: true,
              email: userId,
              firstName: user.firstName || 'Super',
              lastName: user.lastName || 'User',
              role: 'admin',
              superUser: true,
              trashed: false,
              type: 'user',
            };
          }

          resolve(user);

        }, (error) => {
          if (isSuperUser) {
            const user = {
              _id: userId,
              active: true,
              email: userId,
              firstName: 'Super',
              lastName: 'User',
              role: 'admin',
              superUser: true,
              trashed: false,
              type: 'user',
            };

            resolve(user);
            return;
          }

          if (this.config.environment !== 'production') {
            const user = {
              _id: userId,
              active: true,
              email: userId,
              firstName: 'Test',
              lastName: 'User',
              role: this.config.dev.role,
              superUser: false,
              trashed: false,
              type: 'user',
            };

            resolve(user);
            return;
          }

          reject(error);
        });
    });
  }

  search(type, query) {
    return new Promise((resolve, reject) => {
      query.sort = _.isString(query.sort) ? '"' + query.sort + '"' : query.sort;

      this.db().searchAsync('admin', `${type}ByKey`, query)
        .then(resolve, reject);
    });
  }

  list(type, query) {
    return new Promise((resolve, reject) => {
      this.db().viewWithListAsync('admin', `${type}ByKey`, 'sort', query)
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

            Helpers.createOrUpdate(this.db, item)
              .then(resolve, reject);
          }, reject);

      } else if (type === 'schema') {
        this.createOrUpdateIndex()
          .then(() => {
            Helpers.createOrUpdate(this.db, item)
              .then(resolve, reject);
          }, reject);

      } else {
        Helpers.createOrUpdate(this.db, item)
          .then(resolve, reject);
      }
    });
  }

  read(type, query) {
    return new Promise((resolve, reject) => {
      this.db().viewAsync('admin', `${type}ByKey`, query)
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
            Helpers.chunkUpdate(this.db, items, 1000)
              .then(resolve, reject);
          });

      } else {
        Helpers.chunkUpdate(this.db, items, 1000)
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
            Helpers.chunkUpdate(this.db, items, 1000)
              .then(resolve, reject);
          }, reject);

      } else {
        items = items.map((item) => {
          item.trashed = true; return item;
        });
        Helpers.chunkUpdate(this.db, items, 1000)
          .then(resolve, reject);
      }
    });
  }

  createOrUpdateIndex() {
    return new Promise((resolve, reject) => {
      this.db().viewAsync('admin', 'fieldByKey', {
        include_docs: true,
      })
        .then((body) => {
          const fields = body.rows.map(row => row.doc);

          const index = {
            type: 'text',
            ddoc: 'entityIndex',
            index: {
              default_field: {
                enabled: true,
                analyzer: 'standard',
              },
              selector: {
                $and: [{
                  type: 'entity',
                }, {
                  $or: [{
                    trashed: false,
                  }, {
                    trashed: {
                      $exists: false,
                    },
                  }],
                }],
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

          const activeIndex = _.cloneDeep(index);
          activeIndex.name = 'active';

          const publishedIndex = _.cloneDeep(index);
          publishedIndex.name = 'published';
          publishedIndex.index.selector.published = true;

          this.db().indexAsync(activeIndex)
            .then(() => {
              this.db().indexAsync(publishedIndex)
                .then(resolve);
            });
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

      this.db().fetchAsync({
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

          Helpers.chunkUpdate(this.db, schemas, 1000)
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

      this.db().fetchAsync({
        keys: schemaIds,
        include_docs: true,
      })
        .then((response) => {
          const schemas = response.rows.map((row) => {
            const schema = row.doc;

            schema.actions = schema.actions.filter(action => actionSlugs.indexOf(action.slug) === -1);

            return schema;
          });

          Helpers.chunkUpdate(this.db, schemas, 1000)
            .then(resolve, reject);
        }, reject);
    });
  }

}

module.exports = Admin;
