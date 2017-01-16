const multiparty = require('connect-multiparty')();

const Auth = require('../lib/auth');
const Tools = require('../lib/tools');

module.exports = (config) => {

  config._router.get('/tools/export-db.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'tools'), (req, res) => {
    const tools = new Tools(config._db.bind(null, req), config);

    tools.getDb()
      .then((db) => {
        res.setHeader('Content-Disposition', `attachment; filename=${req.session.slug}.json`);
        res.setHeader('Content-Type', 'application/json');
        res.status(200);
        res.send(db);
      }, config._handleError.bind(null, res));
  });

  config._router.post('/tools/import-db.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'tools'), multiparty, (req, res) => {
    const tools = new Tools(config._db.bind(null, req), config);

    tools.importDb(req.files.payload)
      .then((results) => {
        const errors = results.filter(result => result.error);
        res.status(errors.length ? 500 : 200);
        res.send(errors.length ? errors : 'Database imported');
      }, config._handleError.bind(null, res));
  });

  config._router.get('/tools/changes.:ext?', config._ensureAuthenticated, (req, res) => {
    const tools = new Tools(config._db.bind(null, req), config);

    tools.getChanges()
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

};
