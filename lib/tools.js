const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const Cloudant = require('cloudant');
const Db = require('./db');

class Tools {
  constructor(config) {
    this.config = config;
  }

  async getDb() {
    const result = await Db.connect(this.config).fetchAsync({
      include_docs: true,
    });

    return result;
  }

  async getChanges() {
    const result = await Db.connect(this.config).changesAsync({
      limit: 50,
      include_docs: true,
      filter: 'tools/changesEntity',
    });

    return result;
  }

  async importDb(dbBackupFile) {
    const dbName = this.config.db.name;

    const fileConents = await fs.readFileAsync(dbBackupFile.path);

    const docs = JSON.parse(fileConents).rows.map((row) => {
      const doc = row.doc;
      delete doc._rev;
      return doc;
    });

    await fs.unlinkAsync(dbBackupFile.path);

    const cloudant = Promise.promisifyAll(new Cloudant({
      url: this.config.db.url,
    }).db);

    try {
      await cloudant.destroyAsync(dbName);
    } catch (error) {
      //
    }

    await cloudant.createAsync(dbName);

    const result = await Db.connect(this.config, dbName).bulkAsync({ docs });

    return result;
  }

}

module.exports = Tools;
