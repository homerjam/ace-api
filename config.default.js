const path = require('path');

const config = {
  environment: process.env.ENVIRONMENT || 'development',
  debug: process.env.DEBUG || false,

  cache: {
    enabled: process.env.CACHE_ENABLED || false,
    maxSize: process.env.CACHE_MAX_SIZE || 256 * 1000 * 1000, // ~128mb
    maxAge: process.env.CACHE_MAX_AGE || 30 * 60 * 1000, // 30mins
  },

  apiPrefix: process.env.API_PREFIX || '',

  slug: process.env.SLUG,
  baseUrl: process.env.BASE_URL || '',

  forceHttps: process.env.FORCE_HTTPS ? JSON.parse(process.env.FORCE_HTTPS) : false,

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

  logentriesToken: process.env.LOGENTRIES_TOKEN,

  assist: {
    url: process.env.ASSIST_URL,
    username: process.env.ASSIST_USERNAME,
    password: process.env.ASSIST_PASSWORD,
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
    apisJsonKey: process.env.GOOGLE_APIS_JSON_KEY,
  },

  mailgun: {
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN,
  },

  embedly: {
    apiKey: process.env.EMBEDLY_API_KEY,
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    accessKeySecret: process.env.AWS_ACCESS_KEY_SECRET,

    s3: {
      bucket: process.env.AWS_S3_BUCKET,
    },

    // tcode: {
    //   region: process.env.AWS_TCODE_REGION,
    //   pipelineId: process.env.AWS_TCODE_PIPELINE_ID,
    //   bucketIn: process.env.AWS_TCODE_BUCKET_IN,
    //   bucketOut: process.env.AWS_TCODE_BUCKET_OUT,
    // },
  },

  shippo: {
    token: process.env.SHIPPO_TOKEN,
    fromZip: process.env.SHIPPO_FROM_ZIP,
    fromCountry: process.env.SHIPPO_FROM_COUNTRY,
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

  pdf: {
    templates: {},
  },

  email: {
    templatesPath: path.resolve(__dirname, 'email'),
  },
};

module.exports = config;
