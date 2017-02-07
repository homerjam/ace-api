const _ = require('lodash');
const Auth = require('../lib/auth');
const Admin = require('../lib/admin');
const Roles = require('../lib/roles');

const types = ['user', 'schema', 'field', 'action', 'taxonomy'];

module.exports = (config) => {

  config._router.get('/admin/user/current.:ext?', config._ensureAuthenticated, (req, res) => {
    const admin = new Admin(config._db.bind(null, req), config);

    admin.getUser(req.session.email, req.session.superUser)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.get('/admin/roles.:ext?', config._ensureAuthenticated, (req, res) => {
    const roles = _.mapValues(Roles, (role, slug) => {
      role.slug = slug;
      return role;
    });

    res.status(200).send(roles);
  });

  types.forEach((type) => {

    config._router.get(`/admin/${type}/search.:ext?`, config._ensureAuthenticated, (req, res) => {
      const admin = new Admin(config._db.bind(null, req), config);

      admin.search(type, req.query)
        .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
    });

    config._router.get(`/admin/${type}/list.:ext?`, config._ensureAuthenticated, (req, res) => {
      const admin = new Admin(config._db.bind(null, req), config);

      admin.list(type, req.query)
        .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
    });

    config._router.post(`/admin/${type}.:ext?`, config._ensureAuthenticated, Auth.requirePermission.bind(null, 'admin'), (req, res) => {
      const item = req.body.item;

      if (type === 'user') {
        item.slug = req.session.slug;
      }

      const admin = new Admin(config._db.bind(null, req), config);

      admin.create(type, item)
        .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
    });

    config._router.get(`/admin/${type}.:ext?`, config._ensureAuthenticated, Auth.requirePermission.bind(null, 'admin'), (req, res) => {
      const admin = new Admin(config._db.bind(null, req), config);

      admin.read(type, req.query)
        .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
    });

    config._router.put(`/admin/${type}.:ext?`, config._ensureAuthenticated, Auth.requirePermission.bind(null, 'admin'), (req, res) => {
      const admin = new Admin(config._db.bind(null, req), config);

      admin.update(type, req.body.items)
        .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
    });

    config._router.delete(`/admin/${type}.:ext?`, config._ensureAuthenticated, Auth.requirePermission.bind(null, 'admin'), (req, res) => {
      const admin = new Admin(config._db.bind(null, req), config);

      admin.delete(type, req.body.items)
        .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
    });

  });

};
