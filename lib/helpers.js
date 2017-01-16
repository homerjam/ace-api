const _ = require('lodash');
const Promise = require('bluebird');

class Helpers {

  static createOrUpdate (db, doc) {
    return new Promise((resolve, reject) => {
      const _db = db();

      _db.insertAsync(doc)
        .then((response) => {
          doc._id = response.id;
          doc._rev = response.rev;
          resolve(doc);
        }, (error) => {
          if (error.statusCode !== 409) {
            reject(error);
            return;
          }

          _db.getAsync(doc._id)
            .then((response) => {
              doc._rev = response._rev;

              _db.insertAsync(doc)
                .then((response) => {
                  doc._rev = response.rev;
                  resolve(doc);
                }, reject);
            }, reject);
        });
    });
  }

  static chunkUpdate (db, docs, chunkSize = 1000) {
    return new Promise((resolve, reject) => {
      const _db = db();
      const chunks = _.chunk(docs, chunkSize);
      const promises = [];

      chunks.forEach((chunk) => {
        promises.push(new Promise((resolve, reject) => {
          _db.bulkAsync({
            docs: chunk,
          }).then(resolve, reject);
        }));
      });

      Promise.all(promises).then(resolve, reject);
    });
  }

  static groupEntities (entities, groupSize = Infinity) {
    const grouped = [];

    let group = {
      entities: [],
    };

    entities.forEach((entity) => {
      if (!entity.groupBefore || group.entities.length >= groupSize) {
        group = {
          entities: [],
        };
      }

      group.entities.push(entity);

      if (!entity.groupAfter || group.entities.length >= groupSize) {
        group.ratio = 0;

        group.entities.forEach((entity) => {
          group.ratio += (entity.thumbnail || entity).ratio;
        });

        group.entities.forEach((entity) => {
          entity.groupRatio = (entity.thumbnail || entity).ratio / group.ratio;
        });

        grouped.push(group);
      }
    });

    return grouped;
  }

  static now () {
    return JSON.stringify(new Date()).replace(/"/g, '');
  }

  static stringify (object) {
    return JSON.stringify(object).replace(/'/gi, '’');
  }

}

module.exports = Helpers;
