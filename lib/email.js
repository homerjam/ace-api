const path = require('path');
const Promise = require('bluebird');
const _ = require('lodash');
const nodemailer = require('nodemailer');
const Createsend = Promise.promisifyAll(require('createsend-node'));
const nodemailerMailgunTransport = require('nodemailer-mailgun-transport');
const EmailTemplate = require('email-templates').EmailTemplate;
const Inky = require('inky').Inky;
const mjml2html = require('mjml').mjml2html;
const registerMJElement = require('mjml').registerMJElement;
const htmlToText = require('html-to-text');
const moment = require('moment');
const countries = require('i18n-iso-countries');
const sass = require('node-sass');

const Helpers = require('../lib/helpers');

const mcSection = require('../mjml/components/mc-section/lib').default;
const mcImage = require('../mjml/components/mc-image/lib').default;

class Email {
  constructor(config) {
    this.config = config;

    this.helpers = new Helpers(config);

    this.inky = new Inky();

    registerMJElement(mcSection);
    registerMJElement(mcImage);
  }

  getTemplate(template, templateData, options = {}) {
    return new Promise((resolve, reject) => {
      options = _.extend({
        preview: false,
        skipValidation: false,
      }, options);

      const templatePath = path.join(this.config.email.templatesPath, template);

      const style = sass.renderSync({
        file: path.join(templatePath, 'style.scss'),
        sourceMapContents: options.preview,
        sourceMapEmbed: options.preview,
      }).css.toString().replace(/"/g, '\'');

      const emailTemplate = new EmailTemplate(templatePath, {
        disableJuice: options.preview,
        juiceOptions: {
          preserveMediaQueries: true,
          preserveFontFaces: true,
          removeStyleTags: false,
          removeLinkTags: false,
          preserveImportant: true,
        },
        preRenderHook: (file, files, locals, locale) => {
          return new Promise((resolve) => {
            if (file === 'text' && !files[file]) {
              // Create text version from html (if missing)
              emailTemplate.renderHtml(locals, locale)
                .then((html) => {
                  resolve({
                    filename: '.txt',
                    content: htmlToText.fromString(html),
                  });
                });
              return;
            }
            resolve(files[file]);
          });
        },
        postRenderHook: (rendered, file, files, locals, locale) => {
          return new Promise((resolve) => {
            if (file === 'html') {
              const basename = path.basename(files[file].filename);
              if (/\.mjml\./.test(basename)) {
                const convertMjmlResult = mjml2html(rendered, {
                  level: options.skipValidation ? 'skip' : 'soft',
                });

                if (convertMjmlResult.errors && convertMjmlResult.errors.length) {
                  reject(convertMjmlResult.errors);
                  return;
                }

                rendered = convertMjmlResult.html;
              }
              if (/\.inky\./.test(basename)) {
                rendered = this.inky.releaseTheKraken(rendered);
              }
            }
            resolve(rendered);
          });
        },
      });

      const data = _.extend(templateData, {
        template,
        style,
        moment,
        countries,
        helpers: this.helpers,
        preview: options.preview,
        baseUrl: this.config.baseUrl,
      });

      emailTemplate.render(data, (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      });
    });
  }

  sendEmail(email, template, templateData) {
    return new Promise((resolve, reject) => {
      const nodemailerMailgun = nodemailer.createTransport(nodemailerMailgunTransport({
        auth: {
          api_key: this.config.mailgun.apiKey,
          domain: this.config.mailgun.domain,
        },
      }));

      this.getTemplate(template, templateData)
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

  subscribe(details, provider) {
    return new Promise((resolve, reject) => {

      if (provider === 'createsend') {
        if (this.config.createsend) {
          const cs = new Createsend({
            apiKey: this.config.createsend.apiKey,
          });

          const subscribers = Promise.promisifyAll(cs.subscribers);

          subscribers.addSubscriberAsync(this.config.createsend.listId, {
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
      }

      reject('Subscriber list not configured');
    });
  }

}

module.exports = Email;
