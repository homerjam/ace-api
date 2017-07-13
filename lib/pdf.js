const Promise = require('bluebird');
const request = require('request-promise');
const Entity = require('./entity');
const Helpers = require('./helpers');

class Pdf {
  constructor (config) {
    this.config = config;
    this.templates = config.pdf.templates;
    this.assistPdfUrl = `${config.assist.url}/pdf/download`;
  }

  getPayload (templateId, entityId, role) {
    return new Promise((resolve, reject) => {
      if (!this.templates[templateId]) {
        reject('Template not found');
        return;
      }

      const entity = new Entity(this.config);

      entity.entitiesById([entityId], true, false, role)
        .then((entities) => {
          if (entities.length === 0) {
            reject('Entity not found');
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

  getPdf (payload) {
    return new Promise((resolve, reject) => {
      request({
        method: 'POST',
        uri: this.assistPdfUrl,
        encoding: null,
        form: {
          payload: typeof payload === 'object' ? Helpers.stringify(payload) : payload,
        },
      })
        .then(resolve, reject);
    });
  }

}

module.exports = Pdf;
