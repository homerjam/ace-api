const _ = require('lodash');
const Promise = require('bluebird');
const request = require('request-promise');
const Entity = require('./entity');
const Helpers = require('./helpers');
const ClientConfig = require('./client-config');

class Pdf {
  constructor (config) {
    this.config = config;
    this.templates = this.config.pdf.templates;
  }

  getPayload (templateId, entityId, role) {
    return new Promise((resolve, reject) => {
      if (!this.templates[templateId]) {
        reject(new Error('Template not found'));
        return;
      }

      const entity = new Entity(this.config);

      entity.entitiesById([entityId], true, false, role)
        .then((entities) => {
          if (entities.length === 0) {
            reject(new Error('Entity not found'));
            return;
          }

          entities = Entity.flattenValues(entities);

          const payload = this.templates[templateId](entities[0]);

          try {
            resolve(payload);
          } catch (error) {
            reject(error);
          }
        });
    });
  }

  async getPdf (payload) {
    const cc = new ClientConfig(this.config);
    const clientConfig = await cc.get();

    const assetSlug = _.get(clientConfig, 'assets.slug', this.config.slug);
    const assistPdfUrl = `${this.config.assist.url}/${assetSlug}/pdf/download`;

    const response = await request({
      method: 'POST',
      uri: assistPdfUrl,
      encoding: null,
      form: {
        payload: typeof payload === 'object' ? Helpers.stringify(payload) : payload,
      },
    });

    return response;
  }

}

module.exports = Pdf;
