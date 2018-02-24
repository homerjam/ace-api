const Cloudant = require('@cloudant/cloudant');

class Db {
  constructor (config, dbName) {
    this.config = config;

    return Db.connect(config, dbName);
  }

  static connect (config, dbName) {
    const cloudant = new Cloudant({
      url: config.db.url,
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

    return cloudant.db.use(dbName || config.db.name);
  }
}

module.exports = Db;
