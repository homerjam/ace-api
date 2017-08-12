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

  async delete(schemaSlug) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    schemaSlug = _.isArray(schemaSlug) ? schemaSlug : [schemaSlug];

    clientConfig.schemas = _.remove(clientConfig.schemas, schema => schemaSlug.indexOf(schema.slug) === -1);

    return cc.set(clientConfig);
  }
}

module.exports = Schema;
