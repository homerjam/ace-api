const _ = require('lodash');
const Promise = require('bluebird');
const Cloudant = require('cloudant');
const Measured = require('measured');
const colors = require('colors');

const stats = Measured.createCollection();
const limits = {
  queries: 5,
  writes: 20,
  lookups: 100,
};

const METER_CLOUDANT = process.env.METER_CLOUDANT ? JSON.parse(process.env.METER_CLOUDANT) : false;

if (METER_CLOUDANT) {
  setInterval(() => {
    const statsObj = stats.toJSON();

    const statsReport = {
      queries: statsObj.queriesPerSecond ? statsObj.queriesPerSecond.currentRate : 0,
      writes: statsObj.writesPerSecond ? statsObj.writesPerSecond.currentRate : 0,
      lookups: statsObj.lookupsPerSecond ? statsObj.lookupsPerSecond.currentRate : 0,
    };

    _.forIn(statsReport, (value, key) => {
      if (value > limits[key]) {
        console.log(`${key.toUpperCase()} LIMIT BREACHED`.red, value);
      }
    });
  }, 1000);
}

class Db {
  constructor (config) {
    this.config = config;

    return Db.connect(config);
  }

  static requestPlugin (options) {
    const requestDefaults = options.requestDefaults || { jar: false };
    const request = require('request').defaults(requestDefaults);

    const requestWrapper = (req, callback) => {
      if (METER_CLOUDANT) {
        if (/(_all_docs|_view|_search|_find|_geo|_changes)/.test(req.uri)) {
          stats.meter('queriesPerSecond').mark();
        } else if (/POST|PUT|DELETE/.test(req.method)) {
          stats.meter('writesPerSecond').mark();
        } else {
          stats.meter('lookupsPerSecond').mark();
        }
      }

      request(req, (error, headers, body) => {
        callback(error, headers, body);
      });
    };

    return requestWrapper;
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

    opts.plugin = Db.requestPlugin(opts.requestDefaults);

    const cloudant = new Cloudant(opts);

    const db = Promise.promisifyAll(cloudant.use(dbName));

    return db;
  }
}

module.exports = Db;
