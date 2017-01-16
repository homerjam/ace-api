const jwt = require('jsonwebtoken');

module.exports = (config) => {

  config._router.get('/token.:ext?', config._ensureAuthenticated, (req, res) => {
    const token = jwt.sign({
      slug: req.session.slug,
    }, config.auth.tokenSecret, {
      expiresIn: req.params.expires || 7200,
    });

    res.status(200).send(token);
  });

};
