const Promise = require('bluebird');
const Cloudant = require('cloudant');
const MeterPlugin = require('./cloudant-meter-plugin');

const meterPlugin = new MeterPlugin();

class Db {
  constructor (config) {
    this.config = config;

    return Db.connect(config);
  }

  static connect (config, dbName) {
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

    opts.plugin = meterPlugin.requestWrapper(opts.requestDefaults);

    const cloudant = new Cloudant(opts);

    const db = Promise.promisifyAll(cloudant.use(dbName));

    return db;
  }
}

module.exports = Db;
