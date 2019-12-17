const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || 'localhost';

const _ = require('lodash');
const express = require('express');
const http = require('http');
const logger = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const redis = require('redis');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

const AceApiServer = require('./index');

const defaultConfig = require('./config.default');

function Serve(customConfig = {}, listen = true) {
  const config = _.merge({}, defaultConfig, customConfig);

  const app = express();

  const sessionOptions = {
    secret: config.session.secret,
    resave: true,
    saveUninitialized: true,
  };

  if (config.redis.url || config.redis.host) {
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
    redisClient.on('error', console.log);

    sessionOptions.store = new RedisStore({ client: redisClient });
  } else {
    sessionOptions.cookie = {
      maxAge: config.session.ttl,
    };
  }

  app.use(helmet());
  app.use(logger('tiny'));
  app.use(cookieParser());
  app.use(
    bodyParser.json({
      limit: '50mb',
    })
  );
  app.use(
    bodyParser.urlencoded({
      extended: true,
      limit: '50mb',
    })
  );
  app.use(methodOverride());
  app.use(session(sessionOptions));

  AceApiServer(app, config);

  if (listen) {
    const server = http.createServer(app);
    server.on('listening', () => {
      console.log(`listening: http://${HOST}:${PORT}`);
    });
    server.listen(PORT);
  }

  return app;
}

module.exports = Serve;
