const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const jwks = require('jwks-rsa');

class Jwt {
  constructor(config) {
    this.config = config;

    this.checkBearer = expressJwt({
      secret: jwks.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri:
          'https://' + this.config.auth0.domain + '/.well-known/jwks.json',
      }),
      audience: this.config.auth0.audience,
      issuer: 'https://' + this.config.auth0.domain + '/',
      algorithms: ['RS256'],
    });
  }

  signToken(payload, options = {}) {
    return jwt.sign(payload, this.config.auth.tokenSecret, options);
  }

  verifyToken(token) {
    return jwt.verify(token, this.config.auth.tokenSecret);
  }
}

module.exports = Jwt;
