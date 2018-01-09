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

    const options = {
      url: config.db.url,
      requestDefaults: {
        headers: {},
      },
    };

    if (config.db.host) {
      options.requestDefaults.headers.host = config.db.host;
    }

    if (config.db.requestPlugin === 'meter') {
      options.plugin = meterPlugin.requestWrapper({
        meterType: config.db.meterType,
        requestDefaults: options.requestDefaults,
      });

      if (!meterPlugin.isRunning() && config.db.meterType === 'interval') {
        meterPlugin.start();
      }
    } else {
      options.plugins = ['retry429', 'retry5xx', 'retryerror'];
      options.maxAttempt = 5;
      options.retryDelayMultiplier = 2;
      options.retryInitialDelayMsecs = 500;
    }

    const cloudant = new Cloudant(options);

    const db = Promise.promisifyAll(cloudant.use(dbName));

    return db;
  }
}

module.exports = Db;
