const path = require('path');
const multiparty = require('connect-multiparty')();
const Auth = require('../lib/auth');
const Flow = require('../lib/flow');
const File = require('../lib/file');
const S3 = require('../lib/s3');
const Zencode = require('../lib/zencode');

module.exports = (config) => {

  config._router.options('/upload.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'fileCreate'), (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.status(200).send();
  });

  config._router.post('/upload.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'fileCreate'), multiparty, (req, res) => {
    const flow = new Flow(path.join('/tmp', req.session.slug));

    let options = {};

    try {
      options = JSON.parse(req.body.options);
    } catch (error) {
      //
    }

    flow.saveChunk(req.files, req.body.flowChunkNumber, req.body.flowChunkSize, req.body.flowTotalChunks, req.body.flowTotalSize, req.body.flowIdentifier, req.body.flowFilename)
      .then((uploadResult) => {
        res.header('Access-Control-Allow-Origin', '*');

        if (uploadResult.status !== 'complete') {
          res.status(200).send(uploadResult);
          return;
        }

        const file = new File(config._db.bind(null, req), config);
        const fileName = path.join('/tmp', req.session.slug, uploadResult.filename);

        if (options.type === 'field' && options.fieldType === 'attachment') {
          const s3 = new S3(config);

          s3.prepareUpload(config.aws.s3.bucket, fileName, req.session.slug)
            .then((prepResult) => {
              const _file = {
                location: 's3',
                original: prepResult.original,
                mediaType: 'attachment',
                uploaded: new Date(),
                uploadedBy: req.session.email,
                metadata: {
                  s3: prepResult.metadata,
                },
              };

              file.create(_file)
                .then((file) => {
                  _file.id = file.id;

                  s3.upload(fileName, prepResult.uploadOptions)
                    .then((s3Upload) => {
                      res.status(200).send(_file);

                      flow.deleteFile(uploadResult.filename);
                    });
                });
            })
            .catch(config._handleError.bind(null, res));
        }

        if (options.type === 'field' && /^(video|audio)$/.test(options.fieldType)) {
          const s3 = new S3(config);
          const zencode = new Zencode(config._db.bind(null, req), config);

          let mediaType;
          let outputs;

          if (options.fieldType === 'video') {
            mediaType = 'video';
            outputs = options.settings.videoOutputs;
          }
          if (options.fieldType === 'audio') {
            mediaType = 'audio';
            outputs = options.settings.audioOutputs;
          }

          s3.prepareUpload(config.zencoder.s3.bucket, fileName, req.session.slug)
            .then((prepResult) => {
              const _file = {
                location: 's3',
                original: prepResult.original,
                mediaType,
                uploaded: new Date(),
                uploadedBy: req.session.email,
                metadata: {
                  s3: prepResult.metadata,
                  zencoder: {},
                },
              };

              file.create(_file)
                .then((file) => {
                  _file.id = file.id;

                  zencode.createJob(fileName, {
                    mediaType,
                    outputs,
                    metadata: prepResult.metadata,
                    uploadOptions: prepResult.uploadOptions,
                  }, req.session.slug)
                    .then((jobResult) => {
                      _file.metadata.zencoder.job = jobResult.zencoderJob;

                      res.status(200).send(_file);

                      zencode.checkJob(jobResult.zencoderJob.id, file.id);

                      flow.deleteFile(uploadResult.filename);
                    });
                });
            })
            .catch(config._handleError.bind(null, res));
        }

      }, config._handleError.bind(null, res));
  });

  config._router.get('/upload.:ext?', config._ensureAuthenticated, Auth.requirePermission.bind(null, 'fileCreate'), (req, res) => {
    const flow = new Flow(path.join('/tmp', req.session.slug));

    flow.checkChunk(req.query.flowChunkNumber, req.query.flowChunkSize, req.query.flowTotalSize, req.query.flowIdentifier, req.query.flowFilename)
      .then(() => {
        res.header('Access-Control-Allow-Origin', '*');
        res.status(200).send();
      }, () => {
        res.header('Access-Control-Allow-Origin', '*');
        res.status(204).send();
      });
  });

  // config._router.get('/download/:identifier.:ext?', (req, res) => {
  //   flow.write(req.param.identifier, res)
  // })

};
