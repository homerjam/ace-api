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

  pdf: {
    templatesPath: path.resolve(__dirname, 'pdf'),
  },

  email: {
    templatesPath: path.resolve(__dirname, 'email'),
  },

  instagram: {
    clientId: process.env.INSTAGRAM_CLIENT_ID,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
  },

  twitter: {
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    accessTokenKey: process.env.TWITTER_ACCESS_TOKEN_KEY,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },

  mailgun: {
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN,
  },

  embedly: {
    apiKey: process.env.EMBEDLY_API_KEY,
  },

  aws: {
    iamAccessKeyId: process.env.AWS_IAM_ACCESS_KEY_ID,
    iamAccessKeySecret: process.env.AWS_IAM_ACCESS_KEY_SECRET,

    s3: {
      bucket: process.env.AWS_S3_BUCKET,
    },
  },

  shippo: {
    token: process.env.SHIPPO_TOKEN,
    fromZip: process.env.SHIPPO_FROM_ZIP,
    fromCountry: process.env.SHIPPO_FROM_COUNTRY,
  },

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  },

  stripe: {
    clientId: process.env.STRIPE_CLIENT_ID,
    clientSecret: process.env.STRIPE_CLIENT_SECRET,
    apiKey: process.env.STRIPE_API_KEY,
  },

  vimeo: {
    clientId: process.env.VIMEO_CLIENT_ID,
    clientSecret: process.env.VIMEO_CLIENT_SECRET,
  },

  zencoder: {
    apiKey: process.env.ZENCODER_API_KEY,
    s3: {
      bucket: process.env.ZENCODER_S3_BUCKET,
      credentials: process.env.ZENCODER_S3_CREDENTIALS,
    },
  },
};

module.exports = config;
