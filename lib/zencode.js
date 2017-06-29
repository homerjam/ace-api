const _ = require('lodash');
const Promise = require('bluebird');
const mime = require('mime');
const zencoder = require('zencoder');

const S3 = require('./s3');
const Db = require('./db');
const Helpers = require('./helpers');

class Zencode {
  constructor(config) {
    this.config = config;

    this.zencoder = zencoder(config.zencoder.apiKey);

    this.s3 = new S3(config);

    this.s3Credentials = config.zencoder.s3.credentials || 's3';
  }

  checkJob(jobId, fileId) {
    this.getJob(jobId)
      .then((job) => {
        console.log('Zencode.checkJob:', job.jobState, jobId, fileId);

        if (/pending|waiting|processing/.test(job.jobState)) {
          setTimeout(() => {
            this.checkJob(job.jobId, fileId);
          }, 10000);
          return;
        }

        this._updateFile(fileId, job);
      });
  }

  _updateFile(fileId, zencoderJob) {
    Db.connect(this.config).viewAsync('entity', 'byFile', {
      keys: [fileId],
      include_docs: true,
    })
      .then((body) => {
        if (body.rows.length === 0) {
          return;
        }

        const entity = body.rows[0].doc;

        entity.fields = _.mapValues(entity.fields, (field) => {
          if (field.value && field.value.id === fileId) {
            field.value.metadata.zencoder = zencoderJob;
          }
          return field;
        });

        Helpers.createOrUpdate(this.config, entity);
      });

    Db.connect(this.config).getAsync(fileId)
      .then((file) => {
        file.metadata.zencoder = zencoderJob;

        Helpers.createOrUpdate(this.config, file);
      });
  }

  getJob(jobId) {
    return new Promise((resolve, reject) => {
      this.zencoder.Job.details(jobId, (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        const job = {
          jobId: result.job.id,
          jobState: result.job.state,
          fileSize: 0,
          outputs: {},
        };

        if (result.job.thumbnails && result.job.thumbnails.length) {
          const defaultThumbnail = result.job.thumbnails.filter((thumbnail) => {
            return thumbnail.group_label === '_thumb';
          })[0];

          if (defaultThumbnail) {
            job.thumbnail = {
              url: defaultThumbnail.url.replace('http://', 'https://'),
              width: defaultThumbnail.width,
              height: defaultThumbnail.height,
              ratio: parseInt(defaultThumbnail.width, 10) / parseInt(defaultThumbnail.height, 10),
            };
          }
        }

        result.job.output_media_files.forEach((output) => {
          job.fileSize += output.file_size_bytes;

          job.outputs[output.label] = {
            url: output.url.replace('http://', 'https://'),
            width: output.width || null,
            height: output.height || null,
            duration: output.duration_in_ms,
            fileSize: output.file_size_bytes,
            mimeType: mime.lookup(output.url),
          };
        });

        result.job.thumbnails.forEach((thumbnail) => {
          job.fileSize += thumbnail.file_size_bytes;
        });

        resolve(job);
      });
    });
  }

  createJob(fileName, options, slug) {
    return new Promise((resolve, reject) => {
      this.s3.upload(fileName, options.uploadOptions)
        .then((s3Upload) => {

          if (options.mediaType === 'video') {
            // Sort outputs by size to create largest default thumbnail
            options.outputs = options.outputs.sort((a, b) => {
              if (a.maxWidth > b.maxWidth) {
                return -1;
              }
              if (a.maxWidth < b.maxWidth) {
                return 1;
              }
              return 0;
            });

            options.outputs = options.outputs.sort((a, b) => {
              if (a.maxHeight > b.maxHeight) {
                return -1;
              }
              if (a.maxHeight < b.maxHeight) {
                return 1;
              }
              return 0;
            });
          }

          const _outputs = options.outputs.map((output, index) => {
            const baseUrl = `${options.metadata.bucket}/${slug}/${options.metadata.base}`;
            const defaultFormats = {
              video: 'mp4',
              audio: 'mp3',
            };
            const format = output.format || defaultFormats[options.mediaType];

            const _output = {
              credentials: this.s3Credentials,
              rrs: true,
              public: true,
              url: `s3://${baseUrl}/${output.slug}.${format}`,
              label: output.slug,
              quality: output.quality || 3,
              audio_quality: output.audioQuality || 3,
            };

            if (output.audioPreNormalize) {
              _output.audio_pre_normalize = true;
            }

            if (output.audioCompressionRatio) {
              _output.audio_compression_ratio = output.audioCompressionRatio;
            }

            if (options.mediaType === 'video') {
              if (output.maxWidth) {
                _output.width = output.maxWidth;
              }

              if (output.maxHeight) {
                _output.height = output.maxHeight;
              }

              if (!output.thumbnails) {
                output.thumbnails = [];
              }

              if (index === 0) {
                // Default thumbnail
                output.thumbnails.unshift({
                  name: '_thumb',
                  slug: '_thumb',
                  format: 'jpg',
                  times: [0],
                });
              }

              _output.thumbnails = output.thumbnails.map((thumbnail) => {
                const _thumbnail = {
                  credentials: this.zencoderS3Credentials,
                  rrs: true,
                  public: true,
                  base_url: `s3://${baseUrl}`,
                  label: thumbnail.slug,
                  prefix: thumbnail.slug,
                  format: thumbnail.format,
                  start_at_first_frame: true,
                };

                if (thumbnail.number) {
                  _thumbnail.number = thumbnail.number;
                }

                if (thumbnail.times) {
                  _thumbnail.times = thumbnail.times;
                }

                if (thumbnail.interval) {
                  _thumbnail.interval = thumbnail.interval;
                }

                return _thumbnail;
              });
            }

            return _output;
          });

          this.zencoder.Job.create({
            input: `http://${options.metadata.bucket}.s3.amazonaws.com/${options.metadata.src}`,
            outputs: _outputs,
          }, (error, zencoderJob) => {
            if (error) {
              reject(error.errors.join(' '));
              return;
            }

            resolve({
              s3Upload,
              zencoderJob,
            });
          });
        });
    });
  }

}

module.exports = Zencode;
