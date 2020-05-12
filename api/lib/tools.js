const fs = require('fs').promises;
const Cloudant = require('@cloudant/cloudant');
const Db = require('./db');

class Tools {
  constructor(config) {
    this.config = config;

    return this;
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
      filter: 'entity/changes',
    });

    return result;
  }

  async importDb(dbBackupFile) {
    const dbName = this.config.db.name;

    const fileConents = await fs.readFile(dbBackupFile.path);

    const docs = JSON.parse(fileConents).rows.map((row) => {
      const { doc } = row;
      delete doc._rev;
      return doc;
    });

    await fs.unlink(dbBackupFile.path);

    const cloudant = new Cloudant({
      url: this.config.db.url,
      plugins: ['promises', 'retry'],
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
