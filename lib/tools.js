const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const Cloudant = require('cloudant');
const Db = require('./db');

class Tools {
  constructor(config) {
    this.config = config;
  }

  async getDb() {
    const result = await Db.connect(this.config).fetch({
      include_docs: true,
    });

    return result;
  }

  async getChanges() {
    const result = await Db.connect(this.config).changes({
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
      const { doc } = row;
      delete doc._rev;
      return doc;
    });

    await fs.unlinkAsync(dbBackupFile.path);

    const cloudant = new Cloudant({
      url: this.config.db.url,
      plugins: ['promises', 'retry429'],
    }).db;

    try {
      await cloudant.destroy(dbName);
    } catch (error) {
      //
    }

    await cloudant.create(dbName);

    const result = await Db.connect(this.config, dbName).bulk({ docs });

    return result;
  }

}

module.exports = Tools;
