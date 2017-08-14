const _ = require('lodash');
const ClientConfig = require('./clientConfig');

class Schema {
  constructor(config) {
    this.config = config;
  }

  async create(schema) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    clientConfig.schemas.push(schema);

    return cc.set(clientConfig);
  }

  async read(schemaSlug) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    const schema = _.find(clientConfig.schemas, { slug: schemaSlug });

    if (!schema) {
      throw Error(`Schema not found: ${schemaSlug}`);
    }

    return schema;
  }

  async update(schema) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    const index = _.findIndex(clientConfig.schemas, { slug: schema.slug });

    if (index === -1) {
      throw Error(`Schema not found: ${schema.slug}`);
    }

    clientConfig.schemas.splice(index, 1, schema);

    return cc.set(clientConfig);
  }

  async delete(schemaSlugs) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    schemaSlugs = _.isArray(schemaSlugs) ? schemaSlugs : [schemaSlugs];

    clientConfig.schemas = clientConfig.schemas.filter(schema => schemaSlugs.indexOf(schema.slug) === -1);

    clientConfig.schemas = clientConfig.schemas.map((schema) => {
      if (!schema.fields) {
        return schema;
      }
      schema.fields = schema.fields.map((field) => {
        if (!field.settings) {
          return field;
        }
        if (field.settings.schemas) {
          field.settings.schemas = field.settings.schemas.filter(schema => schemaSlugs.indexOf(schema) === -1);
        }
        return field;
      });
      return schema;
    });

    return cc.set(clientConfig);
  }

  async updateAll(schemas) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    clientConfig.schemas = schemas;

    return cc.set(clientConfig);
  }
}

module.exports = Schema;
