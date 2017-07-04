const jwt = require('jsonwebtoken');

class Jwt {
  constructor(config) {
    this.config = config;
  }

  generateToken(payload, expiresIn = null) {
    const options = {};

    if (expiresIn) {
      options.expiresIn = expiresIn;
    }

    const token = jwt.sign(payload, this.config.auth.tokenSecret, options);

    return token;
  }

  verifyToken(token) {
    return jwt.verify(token, this.config.auth.tokenSecret);
  }
}

module.exports = Jwt;
