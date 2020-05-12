const jwt = require('jsonwebtoken');

class Jwt {
  constructor(config) {
    this.config = config;

    return this;
  }

  signToken(payload, options = {}) {
    return jwt.sign(payload, this.config.auth.tokenSecret, options);
  }

  verifyToken(token) {
    return jwt.verify(token, this.config.auth.tokenSecret);
  }
}

module.exports = Jwt;
