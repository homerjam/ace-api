const path = require('path');
const mime = require('mime');
const Promise = require('bluebird');
const uuid = require('node-uuid');
const AWS = require('aws-sdk');

class Transcode {
  constructor(config) {
    this.config = config;

    AWS.config.region = config.aws.tcode.region;

    this.elastictranscoder = new AWS.ElasticTranscoder({
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.accessKeySecret,
    });

    this.s3 = new AWS.S3({
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.accessKeySecret,
    });
  }

  getJob(jobId) {
    return new Promise((resolve, reject) => {
      this.elastictranscoder.readJob({
        Id: jobId,
      }, (error, data) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(data.Job);
      });
    });
  }

  getPresets() {
    return new Promise((resolve, reject) => {
      let presets = [];

      const _getPresets = (pageToken) => {
        this.elastictranscoder.listPresets({
          PageToken: pageToken,
        }, (error, data) => {
          if (error) {
            reject(error);
            return;
          }

          presets = presets.concat(data.Presets);

          if (data.NextPageToken) {
            _getPresets(data.NextPageToken);

          } else {
            resolve(presets);
          }
        });
      };

      _getPresets(null);
    });
  }

  uploadToS3(file, options) {
    return new Promise((resolve, reject) => {
      const fileName = options.fileName;
      const fileSize = file.length;
      const mimeType = mime.lookup(fileName);
      const slug = options.slug;
      const mediaType = mimeType.split('/')[0];
      const id = uuid.v1();
      const ext = path.extname(fileName);

      const inputKey = [slug, mediaType, id + ext].join('/');

      const upload = this.s3.upload({
        Bucket: this.config.aws.tcode.bucketIn,
        Key: inputKey,
        Body: file,
        ACL: 'public-read',
        StorageClass: 'REDUCED_REDUNDANCY',
        Metadata: {
          id,
          slug,
          mediaType,
        },
        Expires: new Date('2099-01-01'),
        CacheControl: 'max-age=31536000',
        ContentType: mimeType,
        ContentLength: fileSize,
      });

      upload.on('httpUploadProgress', () => {
        // console.log(evt);
      });

      upload.send((error) => {
        if (error) {
          reject(error);
          return;
        }

        this.getPresets().then((presets) => {
          presets = presets.filter((preset) => {
            const slugRegExp = new RegExp(slug, 'gi');
            return preset.Type !== 'System' && slugRegExp.test(preset.Name);
          });

          if (presets.length === 0) {
            reject({
              statusCode: 500,
              message: `No presets found for ${slug}`,
            });
            return;
          }

          presets = presets.sort((a, b) => {
            if (Number(a.Video.MaxHeight) < Number(b.Video.MaxHeight)) {
              return 1;
            }
            if (Number(a.Video.MaxHeight) > Number(b.Video.MaxHeight)) {
              return -1;
            }
            return 0;
          });

          const outputs = presets.map((preset, i) => {
            const baseKey = `${slug}/${mediaType}/${id}-${preset.Video.MaxWidth}-${preset.Video.MaxHeight}`;

            const output = {
              PresetId: preset.Id,
              Key: `${baseKey}.${preset.Container}`,
            };

            if (i === 0) {
              output.ThumbnailPattern = `${baseKey}-{count}`;
            }

            return output;
          });

          const thumbnail = `${id}-${presets[0].Video.MaxWidth}-${presets[0].Video.MaxHeight}-00001.${presets[0].Thumbnails.Format}`;

          this.elastictranscoder.readPipeline({
            Id: this.config.aws.tcode.pipelineId,
          }, (error, data) => {
            if (error) {
              reject(error);
              return;
            }

            const outputBucket = data.Pipeline.ContentConfig.Bucket;

            const job = {
              PipelineId: data.Pipeline.Id,
              Input: {
                Key: inputKey,
              },
              Outputs: outputs,
            };

            this.elastictranscoder.createJob(job, (error, data) => {
              if (error) {
                reject(error);
                return;
              }

              const outputs = data.Job.Outputs.map((output) => {
                return {
                  fileName: path.basename(output.Key),
                  mimeType: mime.lookup(output.Key),
                };
              });

              const info = {
                metadata: {
                  job: {
                    id: data.Job.Id,
                    status: data.Job.Status,
                  },
                  input: {
                    fileName: id + ext,
                    bucket: this.config.aws.tcode.bucketIn,
                  },
                },
                original: {
                  fileName,
                  mimeType,
                  fileSize,
                },
                location: 's3',
                bucket: outputBucket,
                mediaType,
                variants: outputs,
                thumbnail,
              };

              resolve(info);
            });
          });
        });
      });
    });
  }

}

module.exports = Transcode;
