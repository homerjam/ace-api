const _ = require('lodash');
const Measured = require('measured');
require('colors');

class MeterPlugin {
  constructor (config = {}) {
    this.stats = Measured.createCollection();

    this.limits = _.merge({}, {
      queries: 5,
      writes: 20,
      lookups: 100,
    }, config.limits || {});

    this.interval = null;
  }

  requestWrapper(options) {
    const requestDefaults = options.requestDefaults || { jar: false };
    const request = require('request').defaults(requestDefaults);

    const requestWrapper = (req, callback) => {
      if (options.meterType) {
        if (/(_all_docs|_view|_search|_find|_geo|_changes)/.test(req.uri)) {
          this.stats.meter('queriesPerSecond').mark();
        } else if (/(_bulk_docs)/.test(req.uri) || /POST|PUT|DELETE/.test(req.method)) {
          this.stats.meter('writesPerSecond').mark();
        } else {
          this.stats.meter('lookupsPerSecond').mark();
        }
      }

      if (options.meterType === 'request') {
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

  start() {
    this.interval = setInterval(() => {
      this.checkStats();
    }, 1000);
  }

  stop() {
    clearInterval(this.interval);
    this.interval = null;
  }

  isRunning() {
    return !!this.interval;
  }
}

module.exports = MeterPlugin;
