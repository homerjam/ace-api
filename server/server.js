process.on('unhandledRejection', (result) => console.error(result));

const _ = require('lodash');
const express = require('express');
const cacheManager = require('cache-manager');
const redisStore = require('cache-manager-redis-store');
const URL = require('url-parse');
const CircularJSON = require('circular-json-es6');
const sizeof = require('object-sizeof');
const deepFreeze = require('deep-freeze');
const XXH = require('xxhashjs');
const http = require('http');
const logger = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const redis = require('redis');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

const App = require('../app/app');

const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || 'localhost';
const HASH_SEED = 0xabcd;

const defaultConfig = require('./server.config');

function Server(customConfig = {}, customContext = {}, listen = true) {
  const config = deepFreeze(
    _.merge({}, App.defaultConfig, defaultConfig, customConfig)
  );

  const expressApp = express();

  const sessionOptions = {
    secret: config.session.secret,
    resave: true,
    saveUninitialized: true,
  };

  if (
    config.environment === 'production' &&
    (config.redis.url || config.redis.host)
  ) {
    const redisOptions = {
      ttl: config.session.ttl,
    };

    if (config.redis.url) {
      redisOptions.url = config.redis.url;
    } else {
      redisOptions.host = config.redis.host;
      redisOptions.port = config.redis.port;
      redisOptions.password = config.redis.password;
      redisOptions.db = config.redis.db;
    }

    const redisClient = redis.createClient(redisOptions);
    redisClient.unref();
    redisClient.on('ready', () => {
      console.log('redis: ready');
    });
    redisClient.on('error', (error) => {
      console.error('redis: error:', error);
    });

    sessionOptions.store = new RedisStore({ client: redisClient });
  } else {
    sessionOptions.cookie = {
      maxAge: config.session.ttl,
    };
  }

  expressApp.use(helmet());
  expressApp.use(logger('tiny'));
  expressApp.use(cookieParser());
  expressApp.use(
    bodyParser.json({
      limit: '50mb',
    })
  );
  expressApp.use(
    bodyParser.urlencoded({
      extended: true,
      limit: '50mb',
    })
  );
  expressApp.use(methodOverride());
  expressApp.use(session(sessionOptions));

  // Async middleware

  const asyncMiddleware = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

  // Skip middleware

  const skipMiddleware = (req) => {
    const prodAllowedRoutes = [
      '/auth/user',
      '/connect/(.+)/callback',
      '/config/info',
    ];

    const devAllowedRoutes = ['/token', '/email'];

    if (
      _.find(prodAllowedRoutes, (route) =>
        new RegExp(`^${route}`).test(req.path)
      )
    ) {
      return true;
    }

    if (
      config.environment === 'development' &&
      _.find(devAllowedRoutes, (route) =>
        new RegExp(`^${route}`).test(req.path)
      )
    ) {
      return true;
    }

    return false;
  };

  // Auth middleware

  const authMiddleware = (req, res, next) => {
    if (skipMiddleware(req)) {
      next();
      return;
    }

    if (!req.session.userId) {
      res.status(401);
      res.send({
        code: 401,
        message: 'Not authorised',
      });
      return;
    }

    next();
  };

  // Permissions middleware

  const permissionMiddleware = (permissions, req, res, next) => {
    if (!req.session.role) {
      res.status(401);
      res.send({
        permissions,
        message: 'Error: undefined role',
      });
      return;
    }

    if (req.session.role === 'super') {
      next();
      return;
    }

    if (_.isString(permissions)) {
      permissions = permissions.split(',');
    }

    let authorised = false;

    permissions.forEach((permission) => {
      if (App.Roles.find(req.session.role).permissions[permission.trim()]) {
        authorised = true;
      }
    });

    if (!App.Roles.find(req.session.role) || !authorised) {
      res.status(401);
      res.send({
        permissions,
        message: 'Error: not authorised',
      });
      return;
    }

    next();
  };

  // Clone and extend config per request/session

  const omitUndefined = (obj) => {
    _.forIn(obj, (value, key, obj) => {
      if (_.isPlainObject(value)) {
        value = omitUndefined(value);

        if (_.keys(value).length === 0) {
          delete obj[key];
        }
      }

      if (_.isUndefined(value)) {
        delete obj[key];
      }
    });

    return obj;
  };

  const cloneConfig = (config) =>
    _.mergeWith(
      {},
      JSON.parse(JSON.stringify(config)),
      omitUndefined(_.cloneDeep(config))
    );

  const getConfig = async ({ slug, userId } = {}) => {
    const configClone = cloneConfig(config);

    configClone.slug = slug;
    configClone.userId = userId;

    configClone.db.name = slug;

    return configClone;
  };

  // Cache

  let cache;

  if (config.cache.enabled) {
    if (config.redis.url || config.redis.host) {
      const redisOptions = {
        ttl: config.cache.ttl,
      };

      if (config.redis.url) {
        redisOptions.url = config.redis.url;
      } else {
        redisOptions.host = config.redis.host;
        redisOptions.port = config.redis.port;
        redisOptions.password = config.redis.password;
        redisOptions.db = config.redis.db;
      }

      cache = cacheManager.caching(
        _.merge({ store: redisStore }, redisOptions)
      );

      const redisClient = cache.store.getClient();
      redisClient.on('ready', () => {
        console.log('cache: ready');
      });
      redisClient.on('error', (error) => {
        console.error('cache: error:', error);
      });
    } else {
      cache = cacheManager.caching({
        store: 'memory',
        ttl: config.cache.ttl,
        max: config.cache.memory.max,
        length: (item) => {
          // const length = Buffer.byteLength(item, 'utf8')
          const length = sizeof(item);
          return length;
        },
      });
    }
  }

  // Cache middleware

  const hash = (req) => {
    const obj = {
      path: req.path,
      query: req.query,
      body: req.body,
    };
    return `${req.session.slug}:${XXH.h64(
      JSON.stringify(obj),
      HASH_SEED
    ).toString(16)}`;
  };

  const cacheMiddleware = asyncMiddleware(async (req, res, next) => {
    const useCachedResponse =
      config.cache.enabled &&
      req.session.role === 'guest' && // TODO: Replace 'guest' with constant
      (req.query.__cache && JSON.parse(req.query.__cache)) !== false;

    if (useCachedResponse) {
      try {
        const key = hash(req);

        let response = await cache.get(key);

        if (typeof response === 'string') {
          try {
            response = JSON.parse(response);
          } catch (error) {
            //
          }

          res.set('X-Cached-Response', true);
          res.status(response ? 200 : 204);
          res.send(response);

          return;
        }
      } catch (error) {
        console.error(error);
      }
    }

    res.set('X-Cached-Response', false);
    next();
  });

  // Response helpers

  const handleError = (req, res, error) => {
    if (Object.prototype.toString.call(error) === '[object Object]') {
      error = CircularJSON.parse(CircularJSON.stringify(error));
    }

    error = error.response || error;

    console.error(error);

    const code = error.statusCode || error.status || error.code || 500;
    const message =
      error.stack ||
      error.error ||
      error.message ||
      error.body ||
      error.data ||
      error.statusText ||
      error;

    res.status(typeof code === 'string' ? 500 : code);
    res.send({
      code,
      message,
    });
  };

  // TODO: convert params to explicit/object
  const handleResponse = async (req, res, response, cacheResponse = false) => {
    if (response === undefined || response === null) {
      response = '';
      res.status(204);
      res.send(response);
    } else {
      response = CircularJSON.stringify(response);
      res.status(200);
      res.send(JSON.parse(response));
    }

    if (cacheResponse && config.cache.enabled && req.session.role === 'guest') {
      // TODO: Replace 'guest' with constant
      const key = hash(req);

      const ttl = req.query.__cache
        ? parseInt(req.query.__cache, 10)
        : config.cache.ttl;

      cache.set(key, response, { ttl });
    }
  };

  // Header middleware

  const headerMiddleware = (req, res, next) => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
      'Access-Control-Expose-Headers': 'X-Slug, X-Role, X-User-Id',
      Vary: 'Accept-Encoding, X-Api-Token',
    };

    if (req.headers['access-control-request-headers']) {
      headers['Access-Control-Allow-Headers'] =
        req.headers['access-control-request-headers'];
    }

    res.set(headers);

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    next();
  };

  // Session middleware

  const jwt = App.Jwt(config);

  const sessionMiddleware = (req, res, next) => {
    if (skipMiddleware(req)) {
      next();
      return;
    }

    const referrer = req.headers.referrer || req.headers.referer;

    if (referrer) {
      const referrerHostname = new URL(referrer).hostname
        .split('.')
        .slice(-2)
        .join('.');

      if (config.api.blacklistReferrer.indexOf(referrerHostname) > -1) {
        res.status(401);
        res.send({
          code: 401,
          message: 'Not authorised, referrer blacklisted',
        });
        return;
      }
    }

    const token =
      req.headers['x-api-token'] || req.query.apiToken || req.session.apiToken;

    if (!token) {
      res.status(401);
      res.send({
        code: 401,
        message: 'Not authorised, missing token',
      });
      return;
    }

    if (config.api.blacklistToken.indexOf(token) > -1) {
      res.status(401);
      res.send({
        code: 401,
        message: 'Not authorised, token blacklisted',
      });
      return;
    }

    try {
      const payload = jwt.verifyToken(token);

      req.session.userId = payload.userId;
      req.session.slug = payload.slug;
      req.session.role = payload.role || 'guest'; // TODO: Replace 'guest' with constant
    } catch (error) {
      res.status(401);
      res.send({
        code: 401,
        message: `Not authorised, token verification failed (${error.message})`,
        error,
      });
      return;
    }

    if (!req.session.slug) {
      res.status(401);
      res.send({
        code: 401,
        message: 'Not authorised, missing slug',
      });
      return;
    }

    if (!req.session.role) {
      req.session.role = 'guest';
    }

    if (req.session.userId) {
      res.set('X-User-Id', req.session.userId);
    }

    res.set('X-Environment', config.environment);
    res.set('X-Slug', req.session.slug);
    res.set('X-Role', req.session.role);

    next();
  };

  // Router

  const router = express.Router();

  const forceHttps = (req, res, next) => {
    if (
      req.headers['x-forwarded-proto'] &&
      req.headers['x-forwarded-proto'] !== 'https' &&
      req.headers['cf-visitor'] &&
      JSON.parse(req.headers['cf-visitor']).scheme !== 'https' // Fix for Cloudflare/Heroku flexible SSL
    ) {
      res.redirect(301, `https://${req.headers.host}${req.path}`);
      return;
    }
    next();
  };

  if (config.environment === 'production' && config.api.forceHttps === true) {
    if (expressApp.enable) {
      expressApp.enable('trust proxy');
    }
    expressApp.use(forceHttps);
  }

  expressApp.get(`/${config.api.prefix}`, (req, res) => {
    res.send('<pre>ace-api</pre>');
  });

  expressApp.use(
    `/${config.api.prefix}`,
    headerMiddleware,
    sessionMiddleware,
    router
  );

  // Context

  const context = _.merge(
    {
      expressApp,
      router,
      cache,
      authMiddleware,
      permissionMiddleware,
      cacheMiddleware,
      asyncMiddleware,
      getConfig,
      handleResponse,
      handleError,
    },
    customContext
  );

  // Inject App into context

  Object.keys(App).forEach((key) => {
    context[key] = App[key];
  });

  const afterResponse = (req, res) => {
    res.removeListener('finish', afterResponse);
    res.removeListener('close', afterResponse);
  };

  if (config.environment !== 'production') {
    expressApp.use((req, res, next) => {
      res.on('finish', afterResponse.bind(null, req, res));
      res.on('close', afterResponse.bind(null, req, res));
      next();
    });
  }

  // Bootstrap Routes

  require('./routes/analytics')(context, config);
  require('./routes/auth')(context, config);
  require('./routes/connect')(context, config);
  require('./routes/cache')(context, config);
  require('./routes/config')(context, config);
  require('./routes/debug')(context, config);
  require('./routes/email')(context, config);
  require('./routes/embedly')(context, config);
  require('./routes/entity')(context, config);
  require('./routes/metadata')(context, config);
  require('./routes/pdf')(context, config);
  require('./routes/provider')(context, config);
  require('./routes/schema')(context, config);
  require('./routes/settings')(context, config);
  require('./routes/shopify')(context, config);
  require('./routes/social')(context, config);
  require('./routes/taxonomy')(context, config);
  require('./routes/token')(context, config);
  require('./routes/tools')(context, config);
  require('./routes/user')(context, config);

  if (listen) {
    const server = http.createServer(expressApp);
    server.on('listening', () => {
      console.log(`listening: http://${HOST}:${PORT}`);
    });
    server.listen(PORT);
  }

  return expressApp;
}

module.exports = Server;
