const _ = require('lodash');
const ClientConfig = require('./client-config');
const Db = require('./db');
const Fields = require('./fields');

class Schema {
  constructor(config) {
    this.config = config;

    return this;
  }

  async create(schema) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    clientConfig.schemas.push(schema);

    await this.updateEntityIndex(clientConfig.schemas);

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

    await this.updateEntityIndex(clientConfig.schemas);

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

    await this.updateEntityIndex(clientConfig.schemas);

    return cc.set(clientConfig);
  }

  async updateAll(schemas) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    clientConfig.schemas = schemas;

    // await this.updateEntityIndex(clientConfig.schemas);

    return cc.set(clientConfig);
  }

  async updateEntityIndex(schemas) {
    let fields = [];

    schemas.forEach((schema) => {
      fields = fields.concat(schema.fields);
    });

    fields = _.uniqBy(fields, 'slug');

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
          ],
        },
        fields: [
          {
            name: 'published',
            type: 'boolean',
          },
          {
            name: 'trashed',
            type: 'boolean',
          },
          {
            name: 'title',
            type: 'string',
          },
          {
            name: 'slug',
            type: 'string',
          },
          {
            name: 'schema',
            type: 'string',
          },
          {
            name: 'modifiedAt',
            type: 'string',
          },
          {
            name: 'publishedAt',
            type: 'string',
          },
        ],
      },
    };

    fields.forEach((field) => {
      const fieldRef = Fields.field(field.type);

      if (/number|string|boolean/.test(fieldRef.dataType)) {
        index.index.fields.push({
          name: `fields.${field.slug}.value`,
          type: fieldRef.dataType,
        });
      }

      if (/array/.test(fieldRef.dataType)) {
        index.index.fields.push({
          name: `fields.${field.slug}.value.[].slug`,
          type: 'string',
        });
      }

      if (/taxonomy/.test(field.type)) {
        index.index.fields.push({
          name: `fields.${field.slug}.value.terms.[].slug`,
          type: 'string',
        });
      }
    });

    const result = await Db.connect(this.config).indexAsync(index);

    return result;
  }

}

module.exports = Schema;
