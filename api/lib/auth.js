const _ = require('lodash');
const expressJwt = require('express-jwt');
const jwks = require('jwks-rsa');
const AuthenticationClient = require('auth0').AuthenticationClient;
const Db = require('./db');
const Jwt = require('./jwt');
const ErrorCode = require('./error-code');

class Auth {
  constructor(config) {
    this.config = config;

    this.jwtCheck = expressJwt({
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

  async authUser(slug, accessToken) {
    const auth0 = new AuthenticationClient({
      domain: this.config.auth0.domain,
    });

    const auth0Profile = await auth0.getProfile(accessToken);

    const userId = auth0Profile.email;

    const isSuperUser =
      _.get(this.config, 'auth.superUserId', '')
        .split(',')
        .map((superUser) => superUser.trim())
        .indexOf(userId) > -1;

    let user;

    if (isSuperUser) {
      user = {
        active: true,
        role: 'super',
      };
    } else {
      try {
        const users = await Db.connect(this.config, slug).get('users');
        user = users.users[userId.toLowerCase()];
      } catch (error) {
        throw new ErrorCode(404, `Database not found: ${slug}`);
      }
    }

    if (!user) {
      throw new ErrorCode(401, `User not found: ${userId}`);
    }

    if (!user.active) {
      throw new ErrorCode(401, `User not active: ${userId}`);
    }

    const payload = {
      slug,
      userId,
      active: user.active,
      role: user.role,
    };

    const jwt = new Jwt(this.config);

    const apiToken = jwt.signToken(payload, {
      // expiresIn: 7200,
    });

    return { ...payload, apiToken };
  }
}

module.exports = Auth;
