const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const Promise = require('bluebird');
const nodemailer = require('nodemailer');
const Createsend = Promise.promisifyAll(require('createsend-node'));
const nodemailerMailgunTransport = require('nodemailer-mailgun-transport');
const EmailTemplate = require('email-templates');
const Inky = require('inky').Inky;
const mjml2html = require('mjml').mjml2html;
const registerMJElement = require('mjml').registerMJElement;
const htmlToText = require('html-to-text');
const moment = require('moment');
const countries = require('i18n-iso-countries');
const sass = require('node-sass');

const ClientConfig = require('./client-config');
const Helpers = require('./helpers');

const mcSection = require('../mjml/components/mc-section/lib').default;
const mcImage = require('../mjml/components/mc-image/lib').default;

class Email {
  constructor(config) {
    this.config = config;

    this.inky = new Inky();

    registerMJElement(mcSection);
    registerMJElement(mcImage);
  }

  getTemplate(templateSlug, templateData, options = {}) {
    return new Promise((resolve, reject) => {
      options = _.merge({}, {
        preview: false,
        inky: false,
        mjml: false,
        skipValidation: false,
      }, options);

      const templatePath = path.resolve(this.config.email.templatesPath, templateSlug);

      // Support ejs for backwards compatibility
      // TODO: convert ejs templates to pug and remove
      let extension = 'pug';
      if (fs.existsSync(`${templatePath}/html.ejs`)) {
        extension = 'ejs';
      }

      const style = sass.renderSync({
        file: path.resolve(templatePath, 'style.scss'),
        sourceMapContents: options.preview,
        sourceMapEmbed: options.preview,
      }).css.toString().replace(/"/g, '\'');

      const emailTemplate = new EmailTemplate({
        views: {
          root: this.config.email.templatesPath,
          options: {
            extension,
          },
        },
        juice: !options.preview,
        juiceResources: {
          preserveMediaQueries: true,
          preserveFontFaces: true,
          removeStyleTags: false,
          removeLinkTags: false,
          preserveImportant: true,
          webResources: {
            links: false,
            scripts: false,
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
            config: _.pick(clientConfig, ['client', 'assets']),
            helpers,
            style,
            moment,
            countries,
            template: templateSlug,
            preview: options.preview,
          });

          emailTemplate.render(`${templateSlug}/html`, templateData)
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

  sendEmail(email, template, templateData, options) {
    return new Promise((resolve, reject) => {
      const nodemailerMailgun = nodemailer.createTransport(nodemailerMailgunTransport({
        auth: {
          api_key: this.config.mailgun.apiKey,
          domain: this.config.mailgun.domain,
        },
      }));

      this.getTemplate(template, templateData, options)
        .then((emailTemplate) => {
          email.html = emailTemplate.html;
          email.text = emailTemplate.text;

          nodemailerMailgun.sendMail(email, (error, metadata) => {
            if (error) {
              reject(error);
              return;
            }

            resolve({
              metadata,
              email,
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
