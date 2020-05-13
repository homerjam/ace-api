const serverConfig = {
  environment: process.env.ENVIRONMENT || 'development',

  dev: {
    slug: process.env.DEV_SLUG || 'dev',
    userId: process.env.DEV_USER_ID || 'dev',
    role: process.env.DEV_ROLE || 'super',
  },

  api: {
    prefix: process.env.API_PREFIX || '',
    forceHttps: process.env.API_FORCE_HTTPS
      ? JSON.parse(process.env.API_FORCE_HTTPS)
      : false,
    blacklistToken: (process.env.API_BLACKLIST_TOKEN || '').split(','),
    blacklistReferrer: (process.env.API_BLACKLIST_REFERRER || '').split(','),
  },

  session: {
    secret: process.env.SESSION_SECRET || 'change_me',
    ttl: parseInt(process.env.SESSION_TTL || 7200, 10),
  },

  cache: {
    enabled: process.env.CACHE_ENABLED
      ? JSON.parse(process.env.CACHE_ENABLED)
      : false,
    ttl: parseInt(process.env.CACHE_TTL || 30, 10) * 60, // 30mins
    memory: {
      max: parseInt(process.env.CACHE_MEMORY_MAX || 128, 10) * 1000 * 1000, // ~128mb
    },
  },

  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || 0, 10),
  },
};

module.exports = serverConfig;
