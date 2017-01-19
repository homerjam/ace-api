const Promise = require('bluebird');
const request = require('request-promise');
const Entity = require('./entity');
const Helpers = require('./helpers');

class Pdf {
  constructor (db, templates, assistUrl) {
    this.db = db;
    this.templates = templates;
    this.assistUrl = assistUrl;
  }

  getPayload (templateId, entityId) {
    return new Promise((resolve, reject) => {
      if (!this.templates[templateId]) {
        reject('Template not found');
        return;
      }

      const entity = new Entity(this.db);

      entity.entitiesById([entityId], true, false, true)
        .then((entities) => {
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
        uri: this.assistUrl,
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
