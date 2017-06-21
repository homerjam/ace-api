const _ = require('lodash');
const Promise = require('bluebird');

const Assist = require('./assist');
const S3 = require('./s3');
const Helpers = require('./helpers');

class File {
  constructor(db, config) {
    this.db = db;
    this.config = config;
    this.assist = new Assist(config);
    this.s3 = new S3(config);
  }

  search(query) {
    return new Promise((resolve, reject) => {
      query.sort = _.isString(query.sort) ? `"${query.sort}"` : query.sort;

      this.db().searchAsync('file', 'all', query)
        .then(resolve, reject);
    });
  }

  create(file) {
    return new Promise((resolve, reject) => {
      file.type = 'file';

      this.db().insertAsync(file)
        .then(resolve, reject);
    });
  }

  delete(fileIds, slug) {
    return new Promise((resolve, reject) => {
      let getFiles;

      if (fileIds === 'trashed') {
        getFiles = this.db().viewAsync('file', 'trashed', {
          include_docs: true,
        });

      } else {
        getFiles = this.db().fetchAsync({
          keys: _.isArray(fileIds) ? fileIds : [fileIds],
          include_docs: true,
        });
      }

      getFiles.then((response) => {
        let files = response.rows.filter(file => !file.value || !file.value.deleted);

        files = files.map(file => file.doc);

        const assistFiles = [];
        const s3Files = [];

        files.forEach((file) => {
          if (file.location === 'assist') {
            assistFiles.push(file.fileName);
          }

          if (file.location === 's3') {
            s3Files.push(file);
          }
        });

        const assistPromise = this.assist.deleteFiles(slug, assistFiles);
        const s3Promise = this.s3.deleteFiles(slug, s3Files);

        Promise.settle([assistPromise, s3Promise])
          .then((results) => {
            const failures = [];

            results.forEach((result) => {
              if (result.isRejected()) {
                failures.push(result.reason());
              }
            });

            if (failures.length) {
              // console.error('failures', failures);

              // reject(failures);
            }

            // this.db().viewAsync('file', 'revs', {
            //   keys: fileIds,
            // })
            //   .then((response) => {
            //     const docs = response.rows.map((row) => {
            //       return {
            //         _id: row.id,
            //         _rev: row.value,
            //         _deleted: true,
            //       };
            //     });

            //     this.db().bulkAsync({ docs }).then(resolve, reject);
            //   }, reject);

            const docs = files.map(file => ({
              _id: file._id,
              _rev: file._rev,
              _deleted: true,
            }));

            Helpers.chunkUpdate(this.db, docs, 1000)
              .then(resolve, reject);
          });
      });
    });
  }

}

module.exports = File;
