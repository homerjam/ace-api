const Cloudant = require('@cloudant/cloudant');

class Db {
  constructor(appConfig, dbName) {
    this.appConfig = appConfig;

    return Db.connect(this.appConfig, dbName);
  }

  static connect(appConfig, dbName) {
    const cloudant = new Cloudant({
      url: appConfig.db.url,
      maxAttempt: 5,
      plugins: [
        'promises',
        {
          retry: {
            retryDelayMultiplier: 2,
            retryInitialDelayMsecs: 500,
          },
        },
      ],
    });

    return cloudant.db.use(dbName || appConfig.db.name);
  }
}

module.exports = Db;
