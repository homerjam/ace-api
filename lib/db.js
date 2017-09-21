const _ = require('lodash');
const Promise = require('bluebird');
const Cloudant = require('cloudant');
const Measured = require('measured');
require('colors');

const stats = Measured.createCollection();
const limits = {
  queries: 5,
  writes: 20,
  lookups: 100,
};

const METER_CLOUDANT_REQUEST = process.env.METER_CLOUDANT_REQUEST ? JSON.parse(process.env.METER_CLOUDANT_REQUEST) : false;
const METER_CLOUDANT_INTERVAL = process.env.METER_CLOUDANT_INTERVAL ? JSON.parse(process.env.METER_CLOUDANT_INTERVAL) : false;

class Db {
  constructor (config) {
    this.config = config;

    return Db.connect(config);
  }

  static checkStats() {
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
  }

  static requestPlugin (options) {
    const requestDefaults = options.requestDefaults || { jar: false };
    const request = require('request').defaults(requestDefaults);

    const requestWrapper = (req, callback) => {
      if (METER_CLOUDANT_REQUEST || METER_CLOUDANT_INTERVAL) {
        if (/(_all_docs|_view|_search|_find|_geo|_changes)/.test(req.uri)) {
          stats.meter('queriesPerSecond').mark();
        } else if (/(_bulk_docs)/.test(req.uri) || /POST|PUT|DELETE/.test(req.method)) {
          stats.meter('writesPerSecond').mark();
        } else {
          stats.meter('lookupsPerSecond').mark();
        }
      }

      if (METER_CLOUDANT_REQUEST) {
        Db.checkStats();
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

if (METER_CLOUDANT_INTERVAL) {
  setInterval(() => {
    Db.checkStats();
  }, 1000);
}

module.exports = Db;
