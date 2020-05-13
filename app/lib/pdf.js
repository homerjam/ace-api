const fs = require('fs').promises;
const path = require('path');
const _ = require('lodash');
const _eval = require('eval');
const got = require('got');
const readdir = require('recursive-readdir');
const Entity = require('./entity');
const ClientConfig = require('./client-config');

class Pdf {
  constructor(appConfig) {
    this.appConfig = appConfig;

    return this;
  }

  async getTemplates() {
    const templates = {};

    const files = await readdir(this.appConfig.pdf.templatesPath);

    files.forEach((file) => {
      if (!/\.js$/.test(file)) {
        return;
      }

      const id = file
        .replace(`${this.appConfig.pdf.templatesPath}/`, '')
        .replace('.js', '');

      // eslint-disable-next-line
      templates[id] = require(file);
    });

    return templates;
  }

  async getPayload(templateId, entityId, role) {
    // if (!this.templates) {
    //   this.templates = await this.getTemplates();
    // }

    // if (!this.templates[templateId]) {
    //   throw Error('Template not found');
    // }

    const templateFile = await fs.readFile(
      path.join(this.appConfig.pdf.templatesPath, `${templateId}.js`),
      'utf-8'
    );

    const template = _eval(templateFile, `${templateId}.js`, {}, true);

    const entity = new Entity(this.appConfig);

    const entities = (
      await entity.entityList([entityId], { children: 2, role })
    ).map(({ doc: entity }) => entity);

    if (entities.length === 0) {
      throw Error('Entity not found');
    }

    const payload = template(Entity.flattenValues(entities)[0]);

    return payload;
  }

  async getPdf(payload) {
    const clientConfig = await ClientConfig(this.appConfig).read();

    const assetSlug = _.get(
      clientConfig,
      'assets.slug',
      this.appConfig.client.slug
    );
    const assistPdfUrl = `${this.appConfig.assist.url}/${assetSlug}/pdf/download`;

    const { body } = await got.post(assistPdfUrl, {
      form: payload,
    });

    return body;
  }
}

module.exports = Pdf;
