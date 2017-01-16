const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const formidable = require('formidable');

const Transcode = require('../lib/transcode');

module.exports = (config) => {
  const transcode = new Transcode(config);
  const uploads = {};

  config._router.get('/transcode/job.:ext?', config._ensureAuthenticated, (req, res) => {
    transcode.getJob(req.query.id)
      .then(config._sendResponse.bind(null, res), config._handleError.bind(null, res));
  });

  config._router.options('/transcode/upload.:ext?', (req, res) => {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });

    res.status(200).end();
  });

  config._router.post('/transcode/upload.:ext?', (req, res) => {
    const options = JSON.parse(req.headers['upload-options']);

    const form = new formidable.IncomingForm();

    form.uploadDir = '/tmp';

    form.parse(req, (err, fields, files) => {
      const file = files.file;
      const name = fields.name;
      const chunk = parseInt(fields.chunk, 10);
      const chunks = parseInt(fields.chunks, 10);

      if (!uploads[name]) {
        uploads[name] = {
          originalFileName: req.headers['file-name'],
          path: [],
          data: [],
        };
      }

      uploads[name].path.push(file.path);

      fs.readFileAsync(file.path).then((fileData) => {
        uploads[name].data.push(fileData);

        if (chunk < chunks - 1) {
          res.status(200).send({
            jsonrpc: '2.0',
            id: name,
          });
        }

        if (chunk === chunks - 1) {
          transcode.uploadToS3(Buffer.concat(uploads[name].data), {
            slug: options.slug,
            fileName: uploads[name].originalFileName,
          })
            .then((info) => {
              Promise.all(uploads[name].path.map(path => fs.unlinkAsync(path))).then(() => {
                delete uploads[name];
                config._sendResponse(res, info);
              }, config._handleError.bind(null, res));
            }, config._handleError.bind(null, res));
        }
      });
    });
  });

};
