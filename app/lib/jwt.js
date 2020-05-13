const jwt = require('jsonwebtoken');

class Jwt {
  constructor(appConfig) {
    this.appConfig = appConfig;

    return this;
  }

  signToken(payload, options = {}) {
    return jwt.sign(payload, this.appConfig.auth.tokenSecret, options);
  }

  verifyToken(token) {
    return jwt.verify(token, this.appConfig.auth.tokenSecret);
  }
}

module.exports = Jwt;
