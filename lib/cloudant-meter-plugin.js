const _ = require('lodash');
const Measured = require('measured');
require('colors');

const METER_CLOUDANT_REQUEST = process.env.METER_CLOUDANT_REQUEST ? JSON.parse(process.env.METER_CLOUDANT_REQUEST) : false;
const METER_CLOUDANT_INTERVAL = process.env.METER_CLOUDANT_INTERVAL ? JSON.parse(process.env.METER_CLOUDANT_INTERVAL) : false;

class MeterPlugin {
  constructor (config = {}) {
    this.stats = Measured.createCollection();

    this.limits = _.merge({}, {
      queries: 5,
      writes: 20,
      lookups: 100,
    }, config.limits || {});

    if (METER_CLOUDANT_INTERVAL) {
      setInterval(() => {
        this.checkStats();
      }, 1000);
    }
  }

  requestWrapper(options) {
    const requestDefaults = options.requestDefaults || { jar: false };
    const request = require('request').defaults(requestDefaults);

    const requestWrapper = (req, callback) => {
      if (METER_CLOUDANT_REQUEST || METER_CLOUDANT_INTERVAL) {
        if (/(_all_docs|_view|_search|_find|_geo|_changes)/.test(req.uri)) {
          this.stats.meter('queriesPerSecond').mark();
        } else if (/(_bulk_docs)/.test(req.uri) || /POST|PUT|DELETE/.test(req.method)) {
          this.stats.meter('writesPerSecond').mark();
        } else {
          this.stats.meter('lookupsPerSecond').mark();
        }
      }

      if (METER_CLOUDANT_REQUEST) {
        this.checkStats();
      }

      request(req, (error, headers, body) => {
        callback(error, headers, body);
      });
    };

    return requestWrapper;
  }

  checkStats() {
    const statsObj = this.stats.toJSON();

    const statsReport = {
      queries: statsObj.queriesPerSecond ? statsObj.queriesPerSecond.count > 1 ? statsObj.queriesPerSecond.currentRate : 0 : 0,
      writes: statsObj.writesPerSecond ? statsObj.writesPerSecond.count > 1 ? statsObj.writesPerSecond.currentRate : 0 : 0,
      lookups: statsObj.lookupsPerSecond ? statsObj.lookupsPerSecond.count > 1 ? statsObj.lookupsPerSecond.currentRate : 0 : 0,
    };

    _.forIn(statsReport, (value, key) => {
      if (value > this.limits[key]) {
        console.log(`${key.toUpperCase()}`.red, value);
      }
    });
  }
}

module.exports = MeterPlugin;
