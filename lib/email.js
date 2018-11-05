const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const Promise = require('bluebird');
const nodemailer = require('nodemailer');
const Createsend = Promise.promisifyAll(require('createsend-node'));
const nodemailerMailgunTransport = require('nodemailer-mailgun-transport');
const EmailTemplate = require('email-templates');
const Inky = require('inky').Inky;
const mjml2html = require('mjml').default;
// eslint-disable-next-line
const registerComponent = require('mjml-core').registerComponent;
// eslint-disable-next-line
const registerDependencies = require('mjml-validator').registerDependencies;
const { McSection, McImage } = require('mjml-mailchimp');
const htmlToText = require('html-to-text');
const moment = require('moment');
const countries = require('i18n-iso-countries');
const sass = require('node-sass');

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

  getTemplate(templateSlug, templateData = {}, templateOptions = {}) {
    return new Promise((resolve, reject) => {
      const options = _.merge({}, {
        inlineStyles: true,
        inky: false,
        mjml: false,
        skipValidation: false,
      }, templateOptions);

      let templatePath = path.join(this.config.email.templatesPath, templateSlug);

      if (!fs.existsSync(templatePath)) {
        templatePath = path.resolve('../email', templateSlug);
      }

      const templateFiles = fs.readdirSync(templatePath);

      let htmlPath = 'html';
      // Support mjml templates
      if (_.find(templateFiles, fileName => /^html\.mjml/.test(fileName))) {
        htmlPath = 'html.mjml';
        options.mjml = true;
      }

      // Support ejs templates (for backwards compatibility)
      // TODO: convert ejs templates to pug and remove
      let extension;
      if (_.find(templateFiles, fileName => /\.ejs$/.test(fileName))) {
        extension = 'ejs';
      }

      let style = '';
      if (_.find(templateFiles, fileName => /^style\.scss$/.test(fileName))) {
        style = sass.renderSync({
          file: path.join(templatePath, 'style.scss'),
          sourceMapContents: !options.inlineStyles,
          sourceMapEmbed: !options.inlineStyles,
        }).css.toString().replace(/"/g, '\'');
      }

      const emailTemplate = new EmailTemplate({
        views: {
          root: this.config.email.templatesPath,
          options: {
            extension,
          },
        },
        juice: options.inlineStyles,
        juiceResources: {
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
        },
        transport: {
          jsonTransport: true,
        },
      });

      const cc = new ClientConfig(this.config);
      const helpers = new Helpers(this.config);

      cc.get()
        .then((clientConfig) => {
          templateData = _.merge({}, templateData, {
            config: _.merge({}, _.pick(this.config, ['cms']), _.pick(clientConfig, ['slug', 'client', 'assets'])),
            helpers,
            style,
            moment,
            countries,
            templateSlug,
          });

          emailTemplate.render(`${templateSlug}/${htmlPath}`, templateData)
            .then((html) => {

              if (options.mjml) {
                const convertMjmlResult = mjml2html(html, {
                  level: options.skipValidation ? 'skip' : 'soft',
                });

                if (convertMjmlResult.errors && convertMjmlResult.errors.length) {
                  reject(convertMjmlResult.errors);
                  return;
                }

                html = convertMjmlResult.html;
              }

              if (options.inky) {
                html = this.inky.releaseTheKraken(html);
              }

              resolve({
                html,
                text: htmlToText.fromString(html),
              });
            }, reject);
        }, reject);
    });
  }

  sendEmail(emailOptions, templateSlug, templateData = {}, templateOptions = {}) {
    return new Promise((resolve, reject) => {
      const nodemailerMailgun = nodemailer.createTransport(nodemailerMailgunTransport({
        auth: {
          api_key: this.config.mailgun.apiKey,
          domain: this.config.mailgun.domain,
        },
      }));

      this.getTemplate(templateSlug, _.merge({}, emailOptions, templateData), templateOptions)
        .then((emailTemplate) => {
          emailOptions.html = emailTemplate.html;
          emailOptions.text = emailTemplate.text;

          nodemailerMailgun.sendMail(emailOptions, (error, metadata) => {
            if (error) {
              reject(error);
              return;
            }

            resolve({
              metadata,
              email: emailOptions,
            });
          });
        }, reject);
    });
  }

  subscribe(details, provider, listId) {
    return new Promise((resolve, reject) => {
      const cc = new ClientConfig(this.config);

      cc.get()
        .then((clientConfig) => {
          if (provider === 'createsend') {
            if (clientConfig.provider.createsend) {
              const cs = new Createsend({
                apiKey: clientConfig.provider.createsend.clientApiKey,
              });

              const subscribers = Promise.promisifyAll(cs.subscribers);

              subscribers.addSubscriberAsync(listId, {
                EmailAddress: details.email,
                Name: details.name,
                Resubscribe: true,
                RestartSubscriptionBasedAutoresponders: true,
              })
                .then((result) => {
                  resolve(`Email.subscribe(): ${result.emailAddress}`);
                })
                .catch((error) => {
                  reject(error.Message);
                });

              return;
            }
            reject(new Error('Subscriber list not configured'));
          }
        }, reject);
    });
  }

}

module.exports = Email;
