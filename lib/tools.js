const Cloudant = require('cloudant');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));

class Tools {
  constructor(db, config) {
    this.db = db;
    this.config = config;

    this.cloudant = (dbname) => {
      const cloudant = new Cloudant({
        url: config.db.url,
      });

      if (dbname) {
        return Promise.promisifyAll(cloudant.use(dbname));
      }

      return Promise.promisifyAll(cloudant.db);
    };
  }

  getDb() {
    return new Promise((resolve, reject) => {
      this.db().fetchAsync({
        include_docs: true,
      }).then(resolve, reject);
    });
  }

  getChanges() {
    return new Promise((resolve, reject) => {
      this.db().changesAsync({
        limit: 50,
        include_docs: true,
        filter: 'tools/changesEntity',
      }).then(resolve, reject);
    });
  }

  importDb(dbBackupFile) {
    return new Promise((resolve, reject) => {
      const dbName = this.db().config.db;

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
      })
      .catch((error) => {
        fs.unlinkAsync(dbBackupFile.path)
          .finally(() => {
            reject(error);
          });
      });
    });
  }

}

module.exports = Tools;
