const path = require('path');

const config = {
  environment: process.env.ENVIRONMENT || 'development',
  debug: process.env.DEBUG || false,

  slug: process.env.SLUG,
  baseUrl: process.env.BASE_URL || '',

  db: {
    url: process.env.DB_URL,
    host: process.env.DB_HOST,
    name: process.env.DB_NAME,
    requestPlugin: process.env.DB_REQUEST_PLUGIN,
    meterType: process.env.DB_METER_TYPE,
  },

  auth: {
    superUserId: process.env.AUTH_SUPER_USER_ID,
    tokenSecret: process.env.AUTH_TOKEN_SECRET || 'change_this_secret',
  },

  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    audience: process.env.AUTH0_AUDIENCE,
  },

  dev: {
    userId: process.env.DEV_USER_ID || 'dev',
    role: process.env.DEV_ROLE || 'super',
  },

  cms: {
    title: process.env.CMS_TITLE,
    url: process.env.CMS_URL,
  },

  assist: {
    url: process.env.ASSIST_URL,
    username: process.env.ASSIST_USERNAME,
    password: process.env.ASSIST_PASSWORD,
  },

  mailgun: {
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN,
  },

  embedly: {
    apiKey: process.env.EMBEDLY_API_KEY,
  },

  pdf: {
    templatesPath: path.resolve(__dirname, 'pdf'),
  },

  email: {
    templatesPath: path.resolve(__dirname, 'email'),
  },

  provider: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },

    instagram: {
      clientId: process.env.INSTAGRAM_CLIENT_ID,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
    },

    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    },

    twitter: {
      consumerKey: process.env.TWITTER_CONSUMER_KEY,
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
      accessTokenKey: process.env.TWITTER_ACCESS_TOKEN_KEY,
      accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    },

    vimeo: {
      clientId: process.env.VIMEO_CLIENT_ID,
      clientSecret: process.env.VIMEO_CLIENT_SECRET,
    },
  },
};

module.exports = config;
