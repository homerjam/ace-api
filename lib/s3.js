const _ = require('lodash');
const Promise = require('bluebird');
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));
const mime = require('mime');
const uuid = require('uuid');
const AWS = require('aws-sdk');

class S3 {
  constructor(config) {
    this.config = config;

    this.s3 = new AWS.S3({
      accessKeyId: config.aws.iamAccessKeyId,
      secretAccessKey: config.aws.iamAccessKeySecret,
    });

    Promise.promisifyAll(Object.getPrototypeOf(this.s3));
  }

  prepareUpload(bucket, fileName, slug = '') {
    return new Promise((resolve, reject) => {
      fs.statAsync(fileName)
        .then((stats) => {
          const fileSize = stats.size;
          const mimeType = mime.getType(fileName);

          const base = uuid.v1();
          const ext = path.extname(fileName);

          const src = [slug, `${base}${ext}`].join('/');

          const uploadOptions = {
            Bucket: bucket,
            Key: src,
            // Body: file,
            ACL: 'public-read',
            StorageClass: 'REDUCED_REDUNDANCY',
            Metadata: {},
            Expires: new Date('2099-01-01'),
            CacheControl: 'max-age=31536000',
            ContentType: mimeType,
            ContentLength: fileSize,
          };

          resolve({
            fileName,
            uploadOptions,
            metadata: {
              bucket,
              src,
              base,
              ext,
            },
            original: {
              fileName: path.basename(fileName),
              fileSize,
              mimeType,
            },
          });
        }, reject);
    });
  }

  upload(fileName, uploadOptions) {
    return new Promise((resolve, reject) => {
      uploadOptions.Body = fs.createReadStream(fileName);

      this.s3.upload(uploadOptions)

        // .on('httpUploadProgress', (event) => {
        //   // console.log(event);
        // })

        .send((error, data) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(data);
        });
    });
  }

  getSignedUrl(bucket, key, filename) {
    return this.s3.getSignedUrlAsync('getObject', {
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    });
  }

  getObject(bucket, key) {
    return this.s3.getObjectAsync({
      Bucket: bucket,
      Key: key,
    });
  }

  deleteFiles(slug, files) {
    return new Promise((reject, resolve) => {
      if (files.length === 0) {
        resolve();
        return;
      }

      const buckets = _.uniq(files.map((file) => {
        try {
          return file.metadata.s3.bucket;
        } catch (error) {
          return null;
        }
      }).filter(bucket => bucket));

      const bucketMap = {};

      const promises = [];


      files.forEach((file) => {
        buckets.forEach((bucket) => {
          try {
            promises.push(this.s3.listObjectsAsync({
              Bucket: bucket,
              Prefix: `${slug}/${file.metadata.s3.base}`,
            }));
          } catch (error) {
            console.log(error);
          }
        });
      });

      Promise.all(promises).then((results) => {
        results.forEach((result) => {
          result.Contents.forEach((file) => {
            if (!bucketMap[result.Name]) {
              bucketMap[result.Name] = [];
            }

            bucketMap[result.Name].push({
              Key: file.Key,
            });
          });
        });

        const promises = [];

        _.forEach(bucketMap, (files, bucketName) => {
          promises.push(this.s3.deleteObjectsAsync({
            Bucket: bucketName,
            Delete: {
              Objects: files,
            },
          }));
        });

        if (promises.length === 0) {
          resolve();
          return;
        }

        Promise.all(promises).then(resolve, reject);
      }, reject);
    });
  }

}

module.exports = S3;
