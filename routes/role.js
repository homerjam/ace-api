const _ = require('lodash');
const Roles = require('../lib/roles');

module.exports = (config) => {

  config._router.get('/roles.:ext?', config._ensureAuthenticated, (req, res) => {
    const roles = _.mapValues(Roles, (role, slug) => {
      role.slug = slug;
      return role;
    });

    res.status(200).send(roles);
  });

};
