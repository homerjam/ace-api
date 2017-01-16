const env = require('node-env-file');
const _ = require('lodash');
const express = require('express');
const Promise = require('bluebird');
const Cloudant = require('cloudant');
const Logger = require('le_node');
const lru = require('lru-cache');
const jwt = require('jsonwebtoken');
const CircularJSON = require('circular-json');
const memwatch = require('memwatch-next');
const heapdump = require('heapdump');

if (!process.env.ENVIRONMENT) {
  env('.env');
}

const defaultConfig = require('./config.default');

const cacheMaxSize = 32 * 1000 * 1000;
const cacheMaxAge = 30 * 60 * 1000;

function ensureAuthenticated (req, res, next) {
  if (!req.session) {
    res.status(500).send('Session not initialised, please refresh');
    return;
  }

  req.session.referer = req.originalUrl;

  if (!req.session.userAuthorised) {
    res.status(401).send('Not authorised');
    return;
  }

  next();
}

defaultConfig._ensureAuthenticated = ensureAuthenticated;

function Api (config) {
  config = _.extend(defaultConfig, config);

  if (config.environment !== 'production') {
    require('trace');
    require('clarify');
  }

  if (config.logentriesToken) {
    config._log = new Logger({
      token: config.logentriesToken,
    });
  }

  function connect (dbName) {
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

  config._db = (req = null) => {
    const dbName = config.db.name ? config.db.name : req && (req.session.dbName || req.session.slug) ? req.session.dbName || req.session.slug : config.db.name;
    return connect(dbName);
  };

  function preAuth (req, res, next) {
    if (config.environment !== 'production') {
      if (!req.session.slug) {
        req.session.slug = config.dev.slug;
      }
      if (!req.session.dbName) {
        req.session.dbName = config.dev.dbName;
      }
      req.session.email = config.dev.email;
      req.session.role = config.dev.role;
      req.session.superUser = config.dev.superUser;

      req.session.userAuthorised = true;
    }

    res.set('x-environment', config.environment);
    res.set('x-slug', req.session.slug ? req.session.slug : config.db.name);

    // res.set('x-role', req.session.role)
    // res.set('x-super-user', req.session.superUser)
    // res.set('x-user-authorised', req.session.userAuthorised ? true : false)

    next();
  }

  let cache;

  if (config.cache) {
    cache = lru({
      max: cacheMaxSize,
      length: item => Buffer.byteLength(item, 'utf8'),
      maxAge: cacheMaxAge,
    });
  }

  const router = express.Router();

  router.get('/cache/clear', (req, res) => {
    if (config.cache) {
      const itemsCount = cache.keys().length;

      cache.reset();

      res.status(200).send(`Successfully cleared ${itemsCount} items from the cache`);

    } else {
      res.status(200).send('Cache disabled');
    }
  });

  function useCachedResponse (req, res, next) {
    req.session.guestAuthorised = req.session.guestAuthorised ? req.session.guestAuthorised : config.forceAuth;

    if (req.headers.token || req.session.token) {
      try {
        const payload = jwt.verify(req.headers.token || req.session.token, config.auth.tokenSecret);

        if (payload.slug === config.slug) {
          req.session.guestAuthorised = true;
        } else {
          console.error('Token error: slug mismatch');
        }
      } catch (error) {
        console.error('Token error: expired');
      }
    }

    res.set('x-guest-authorised', req.session.guestAuthorised);
    res.set('x-from-cache', false);

    if (config.cache) {
      const key = req.url.replace(`/${config.apiPrefix}`, '');
      const fromCache = config.cache && cache.has(key) && req.session.guestAuthorised !== true;

      if (fromCache) {
        console.log('Cache usage:', Math.round((cache.length / cacheMaxSize) * 100), '%');

        res.set('x-from-cache', true);
        res.status(200).send(cache.get(key));

        return;
      }
    }

    next();
  }

  function handleError (res, error) {
    if (_.isObject(error)) {
      error = JSON.parse(CircularJSON.stringify(error));
    }
    const statusCode = error.statusCode || error.code || 500;
    const errorMessage = error.stack || error.error || error.message || error.body || error.data || error;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(typeof statusCode === 'string' ? 500 : statusCode);
    res.send({
      code: statusCode,
      message: errorMessage,
    });
    console.error(errorMessage);
  }

  function sendResponse (res, response) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200);
    res.send(response);
  }

  function cacheAndSendResponse (req, res, body) {
    if (!config.cache) {
      return;
    }

    if (req.session.guestAuthorised && cache.has(req.url)) {
      cache.del(req.url);

    } else {
      cache.set(req.url, body);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200);
    res.send(body);
  }

  function afterResponse (req, res) {
    res.removeListener('finish', afterResponse);
    res.removeListener('close', afterResponse);

    if (req.query.heapdiff) {
      const diff = res._hd.end();
      diff.change.details.forEach((detail) => {
        if (/^(Array|Object|String)$/.test(detail.what)) {
          console.log('Heap diff', detail);
        }
      });
    }

    if (req.query.heapdump) {
      heapdump.writeSnapshot((error, filename) => {
        console.log('Heap dump written to', filename);
      });
    }
  }

  if (config._app) {
    if (config.environment !== 'production') {
      config._app.use((req, res, next) => {
          res.on('finish', afterResponse.bind(null, req, res));
          res.on('close', afterResponse.bind(null, req, res));

          if (req.query.heapdiff) {
            res._hd = new memwatch.HeapDiff();
          }

        next();
      });
    }

    config._router = router;
    config._app.use(`/${config.apiPrefix}`, preAuth, router);
    config._cache = cache;
    config._ensureAuthenticated = config._ensureAuthenticated;
    config._handleError = handleError;
    config._useCachedResponse = useCachedResponse;
    config._sendResponse = sendResponse;
    config._cacheAndSendResponse = cacheAndSendResponse;

    require('./routes/admin')(config);
    require('./routes/analytics')(config);
    require('./routes/auth')(config);
    require('./routes/debug')(config);
    require('./routes/ecommerce')(config);
    require('./routes/email')(config);
    require('./routes/embedly')(config);
    require('./routes/entity')(config);
    require('./routes/file')(config);
    require('./routes/metadata')(config);
    require('./routes/pdf')(config);
    require('./routes/role')(config);
    require('./routes/settings')(config);
    require('./routes/shippo')(config);
    require('./routes/social')(config);
    require('./routes/stripe')(config);
    require('./routes/taxonomy')(config);
    require('./routes/token')(config);
    require('./routes/tools')(config);
    require('./routes/transcode')(config);
    require('./routes/upload')(config);
    require('./routes/zencode')(config);
  }

  return {
    config,
    Admin: require('./lib/admin'),
    Analytics: require('./lib/analytics'),
    Assist: require('./lib/assist'),
    Auth: require('./lib/auth'),
    Ecommerce: require('./lib/ecommerce'),
    Email: require('./lib/email'),
    Embedly: require('./lib/embedly'),
    Entity: require('./lib/entity'),
    File: require('./lib/file'),
    Flow: require('./lib/flow'),
    Helpers: require('./lib/helpers'),
    Instagram: require('./lib/instagram'),
    Pdf: require('./lib/pdf'),
    Roles: require('./lib/roles'),
    Settings: require('./lib/settings'),
    Shippo: require('./lib/shippo'),
    Stripe: require('./lib/stripe'),
    S3: require('./lib/s3'),
    Taxonomy: require('./lib/taxonomy'),
    Tools: require('./lib/tools'),
    Transcode: require('./lib/transcode'),
    Zencode: require('./lib/zencode'),
  };
}

Api.Helpers = require('./lib/helpers');

module.exports = Api;
