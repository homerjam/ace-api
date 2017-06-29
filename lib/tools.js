const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const Db = require('./db');

class Tools {
  constructor(config) {
    this.config = config;
  }

  getDb() {
    return new Promise((resolve, reject) => {
      Db.connect(this.config).fetchAsync({
        include_docs: true,
      }).then(resolve, reject);
    });
  }

  getChanges() {
    return new Promise((resolve, reject) => {
      Db.connect(this.config).changesAsync({
        limit: 50,
        include_docs: true,
        filter: 'tools/changesEntity',
      }).then(resolve, reject);
    });
  }

  importDb(dbBackupFile) {
    return new Promise((resolve, reject) => {
      const dbName = this.config.db.name;

      const readFile = fs.readFileAsync(dbBackupFile.path);

      const getDocs = readFile.then(fileConents => JSON.parse(fileConents).rows.map((row) => {
        const doc = row.doc;
        delete doc._rev;
        return doc;
      }));

      const destroyDb = getDocs.then(() => {
        return new Promise((resolve) => {
          this.cloudant().destroyAsync(dbName).then(resolve, resolve);
        });
      });

      const createDb = destroyDb.then(() => this.cloudant().createAsync(dbName));

      const insertDocs = createDb.then(() => this.cloudant(dbName).bulkAsync({ docs: getDocs.value() }));

      const deleteFile = insertDocs.then(() => fs.unlinkAsync(dbBackupFile.path));

      deleteFile.then(() => {
        resolve(insertDocs.value());
      }, (error) => {
        fs.unlinkAsync(dbBackupFile.path)
          .finally(() => {
            reject(error);
          });
      });
    });
  }

}

module.exports = Tools;
