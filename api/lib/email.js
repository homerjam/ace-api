const path = require('path');
const util = require('util');
const fs = require('fs').promises;
const _ = require('lodash');
const nodemailer = require('nodemailer');
const Createsend = require('createsend-node');
const nodemailerMailgunTransport = require('nodemailer-mailgun-transport');
const Inky = require('inky').Inky;
const mjml2html = require('mjml');
const { registerComponent } = require('mjml-core');
const { registerDependencies } = require('mjml-validator');
const { McSection, McImage } = require('mjml-mailchimp');
const htmlToText = require('html-to-text');
const moment = require('moment');
const countries = require('i18n-iso-countries');
const sass = util.promisify(require('node-sass').render);
const pug = require('pug');
const juice = require('juice');

const ClientConfig = require('./client-config');
const Helpers = require('./helpers');

class Email {
  constructor(config) {
    this.config = config;

    this.inky = new Inky();

    registerComponent(McSection);
    registerComponent(McImage);
    registerDependencies({
      'mc-section': ['mj-column', 'mj-group', 'mj-raw'],
      'mj-column': ['mc-image'],
      'mj-hero': ['mc-image'],
    });
  }

  async getTemplate(templateSlug, templateData = {}, templateOptions = {}) {
    const options = _.merge(
      {},
      {
        inlineStyles: true,
        inky: false,
        mjml: false,
        skipValidation: false,
      },
      templateOptions
    );

    let templatePath = path.join(this.config.email.templatesPath, templateSlug);

    try {
      await fs.stat(templatePath);
    } catch (error) {
      templatePath = path.resolve('../email', templateSlug);
    }

    const templateFiles = await fs.readdir(templatePath);

    let htmlFileName = 'html';
    // Support mjml templates
    if (_.find(templateFiles, (fileName) => /^html\.mjml/.test(fileName))) {
      htmlFileName = 'html.mjml';
      options.mjml = true;
    }

    let htmlFileExtension = 'html';
    if (_.find(templateFiles, (fileName) => /\.pug$/.test(fileName))) {
      htmlFileExtension = 'pug';
    }

    let style = '';
    if (_.find(templateFiles, (fileName) => /^style\.scss$/.test(fileName))) {
      style = (
        await sass({
          file: path.join(templatePath, 'style.scss'),
          sourceMapContents: !options.inlineStyles,
          sourceMapEmbed: !options.inlineStyles,
        })
      ).css
        .toString()
        .replace(/"/g, "'");
    }

    const cc = new ClientConfig(this.config);
    const clientConfig = await cc.get();
    const helpers = new Helpers(this.config);

    templateData = _.merge({}, templateData, {
      config: _.merge(
        {},
        _.pick(this.config, ['cms']),
        _.pick(clientConfig, ['slug', 'client', 'assets'])
      ),
      helpers,
      style,
      moment,
      countries,
      templateSlug,
    });

    let html;
    if (htmlFileExtension === 'html') {
      html = fs.readFile(
        `${templatePath}/${htmlFileName}.${htmlFileExtension}`
      );
    }
    if (htmlFileExtension === 'pug') {
      html = pug.renderFile(
        `${templatePath}/${htmlFileName}.${htmlFileExtension}`,
        templateData
      );
    }

    if (options.mjml) {
      const convertMjmlResult = mjml2html(html, {
        level: options.skipValidation ? 'skip' : 'soft',
      });

      if (convertMjmlResult.errors && convertMjmlResult.errors.length) {
        throw Error(
          _.uniq(
            convertMjmlResult.errors.map((error) => error.formattedMessage)
          ).join('\n')
        );
      }

      html = convertMjmlResult.html;
    }

    if (options.inky) {
      html = this.inky.releaseTheKraken(html);
    }

    if (options.inlineStyles) {
      html = juice(html, {
        preserveMediaQueries: true,
        preserveFontFaces: true,
        removeStyleTags: false,
        removeLinkTags: false,
        preserveImportant: true,
        webResources: {
          links: false,
          scripts: false,
          images: false,
          // relativeTo: '',
        },
      });
    }

    return {
      html,
      text: htmlToText.fromString(html),
    };
  }

  async sendEmail(
    emailOptions,
    templateSlug,
    templateData = {},
    templateOptions = {}
  ) {
    const nodemailerMailgun = nodemailer.createTransport(
      nodemailerMailgunTransport({
        auth: {
          api_key: this.config.mailgun.apiKey,
          domain: this.config.mailgun.domain,
        },
      })
    );

    const emailTemplate = await this.getTemplate(
      templateSlug,
      _.merge({}, emailOptions, templateData),
      templateOptions
    );

    emailOptions.html = emailTemplate.html;
    emailOptions.text = emailTemplate.text;

    const metadata = await nodemailerMailgun.sendMail(emailOptions);

    return {
      metadata,
      email: emailOptions,
    };
  }

  async subscribe(details, provider, listId) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    if (provider === 'createsend') {
      if (!clientConfig.provider.createsend) {
        throw Error('Provider not configured');
      }

      const cs = new Createsend({
        apiKey: clientConfig.provider.createsend.clientApiKey,
      });

      const addSubscriber = util.promisify(cs.subscribers.addSubscriber);

      try {
        const result = await addSubscriber(listId, {
          EmailAddress: details.email,
          Name: details.name,
          Resubscribe: true,
          RestartSubscriptionBasedAutoresponders: true,
        });
        return result;
      } catch (error) {
        throw Error(error.Message);
      }
    }

    throw Error('Unknown provider');
  }
}

module.exports = Email;
