const _ = require('lodash');
const request = require('request-promise');
const readdir = require('recursive-readdir');
const Entity = require('./entity');
const ClientConfig = require('./client-config');

class Pdf {
  constructor (config) {
    this.config = config;
  }

  async getTemplates() {
    const templates = {};

    const files = await readdir(this.config.pdf.templatesPath);

    files.forEach((file) => {
      if (!/\.js$/.test(file)) {
        return;
      }

      const id = file
        .replace(`${this.config.pdf.templatesPath}/`, '')
        .replace('.js', '');

      // eslint-disable-next-line
      templates[id] = require(file);
    });

    return templates;
  }

  async getPayload (templateId, entityId, role) {
    if (!this.templates) {
      this.templates = await this.getTemplates();
    }

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
