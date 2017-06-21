const Promise = require('bluebird');
const request = require('request-promise');
const passwordHash = require('password-hash');

class Assist {
  constructor(config) {
    this.config = config;
  }

  deleteFiles(slug, fileNames) {
    return new Promise((resolve, reject) => {

      if (fileNames.length === 0) {
        resolve();
        return;
      }

      request({
        method: 'DELETE',
        url: `${this.config.assist.url}/files/delete`,
        json: {
          files: fileNames,
          slug,
        },
        auth: {
          user: this.config.assist.username,
          pass: passwordHash.generate(this.config.assist.password),
          sendImmediately: false,
        },
      })
        .then((response) => {
          if (response.statusCode === 200) {
            resolve(response);
            return;
          }

          reject(response);
        }, reject);

    });
  }

}

module.exports = Assist;
