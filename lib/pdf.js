const _ = require('lodash');
const request = require('request-promise');
const Entity = require('./entity');
const ClientConfig = require('./client-config');

class Pdf {
  constructor (config) {
    this.config = config;
    this.templates = this.config.pdf.templates;
  }

  async getPayload (templateId, entityId, role) {
    if (!this.templates[templateId]) {
      throw new Error('Template not found');
    }

    const entity = new Entity(this.config);

    const entities = (await entity.entityList([entityId], 2, false, role)).map(row => row.doc);

    if (entities.length === 0) {
      throw new Error('Entity not found');
    }

    const payload = this.templates[templateId](Entity.flattenValues(entities)[0]);

    return payload;
  }

  async getPdf (payload) {
    const cc = new ClientConfig(this.config);
    const clientConfig = await cc.get();

    const assetSlug = _.get(clientConfig, 'assets.slug', this.config.slug);
    const assistPdfUrl = `${this.config.assist.url}/${assetSlug}/pdf/download`;

    payload = typeof payload === 'object' ? JSON.stringify(payload).replace(/'/gi, '’') : payload;

    const response = await request({
      method: 'POST',
      uri: assistPdfUrl,
      encoding: null,
      form: {
        payload,
      },
    });

    return response;
  }

}

module.exports = Pdf;
