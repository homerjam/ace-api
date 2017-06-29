const Promise = require('bluebird');
const Cloudant = require('cloudant');

class Db {
  constructor(config) {
    this.config = config;

    return Db.connect(config);
  }

  static connect(config, dbName) {
    dbName = dbName || config.db.name;

    const opts = {
      url: config.db.url,
      requestDefaults: {
        headers: {},
      },
    };

    if (config.db.host) {
      opts.requestDefaults.headers.host = config.db.host;
    }

    const cloudant = new Cloudant(opts);

    const db = Promise.promisifyAll(cloudant.use(dbName));

    return db;
  }
}

module.exports = Db;
