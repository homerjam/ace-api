const Auth = require('../lib/auth');
const File = require('../lib/file');
const S3 = require('../lib/s3');

module.exports = (config) => {

  config._router.get('/file/search.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'fileRead'), (req, res) => {
    const file = new File(config._db.bind(null, req), config);

    file.search(req.query)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.post('/file.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'fileCreate'), (req, res) => {
    const file = new File(config._db.bind(null, req), config);

    file.create(req.body.file)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.delete('/file.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'fileDelete'), (req, res) => {
    const file = new File(config._db.bind(null, req), config);

    file.delete(req.body.file || req.body.files, req.session.slug)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.delete('/file/trashed.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'fileDelete'), (req, res) => {
    const file = new File(config._db.bind(null, req), config);

    file.delete('trashed', req.session.slug)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.get('/file/download/s3.:ext?', (req, res) => {
    const s3 = new S3(config);

    s3.getSignedUrl(req.query.bucket, req.query.key, req.query.filename)
      .then((url) => {
        res.status(200);

        if (req.query.redirect && !JSON.parse(req.query.redirect)) {
          res.send(url);
          return;
        }

        res.redirect(url);
      }, config._handleError.bind(null, res));
  });

  config._router.get('/file/download/s3/:filename.:ext?', (req, res) => {
    const s3 = new S3(config);

    s3.getObject(req.query.bucket, req.query.key)
      .then((result) => {
        res.attachment(req.params.filename);
        res.send(result);
      }, config._handleError.bind(null, res));
  });

};
