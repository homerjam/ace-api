const Promise = require('bluebird');
const google = require('googleapis');

const analytics = google.analytics('v3');

class Analytics {
  constructor(config) {
    this.config = config;
  }

  get(query) {
    return new Promise((resolve, reject) => {
      const scopes = ['https://www.googleapis.com/auth/analytics.readonly'];

      const obj = JSON.parse(this.config.google.apisJsonKey);
      const email = obj.client_email;
      const key = obj.private_key;

      const jwtClient = new google.auth.JWT(
        email,
        null,
        key,
        scopes
      );

      jwtClient.authorize((error) => {
        if (error) {
          reject(error);
          return;
        }

        query.auth = jwtClient;

        analytics.data.ga.get(query, (error, entries) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(entries);
        });
      });
    });
  }

}

module.exports = Analytics;
