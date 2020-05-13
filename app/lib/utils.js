const _ = require('lodash');
const Db = require('./db');

class Utils {
  constructor(appConfig) {
    this.appConfig = appConfig;

    return this;
  }

  static async createOrUpdate(appConfig, doc) {
    const db = Db.connect(appConfig);
    let response;

    try {
      response = await db.insert(doc);

      doc._id = response.id;
      doc._rev = response.rev;

      return doc;
    } catch (error) {
      if (error.statusCode !== 409) {
        throw error;
      }
    }

    response = await db.get(doc._id);

    doc._rev = response._rev;

    response = await db.insert(doc);

    doc._rev = response.rev;

    return doc;
  }

  static async chunkBulk(appConfig, docs, chunkSize = 1000) {
    const db = Db.connect(appConfig);

    const chunks = _.chunk(docs, chunkSize);

    const promises = chunks.map((chunk) =>
      db.bulk({
        docs: chunk,
      })
    );

    const results = _.flatten(await Promise.all(promises));

    const revMap = _.reduce(
      results,
      (result, value) => {
        if (value.ok) {
          result[value.id] = value.rev;
        }
        return result;
      },
      {}
    );

    docs = docs.map((doc, i) => {
      if (doc._id) {
        doc._rev = revMap[doc._id];
      } else {
        doc._id = results[i].id;
        doc._rev = results[i].rev;
      }
      return doc;
    });

    return docs;
  }

  static now() {
    return JSON.stringify(new Date()).replace(/"/g, '');
  }

  static replace(array, replacementObject, key) {
    return array.map((object) => {
      if (object[key] === replacementObject[key]) {
        return replacementObject;
      }
      return object;
    });
  }
}

module.exports = Utils;
