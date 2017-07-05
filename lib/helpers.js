const _ = require('lodash');
const Promise = require('bluebird');
const Db = require('./db');

class Helpers {
  constructor(config) {
    this.config = config;
    this.assistUrl = config.assist.url;
    this.slug = config.slug;
  }

  static createOrUpdate (config, doc) {
    return new Promise((resolve, reject) => {
      Db.connect(config).insertAsync(doc)
        .then((response) => {
          doc._id = response.id;
          doc._rev = response.rev;
          resolve(doc);
        }, (error) => {
          if (error.statusCode !== 409) {
            reject(error);
            return;
          }

          Db.connect(config).getAsync(doc._id)
            .then((response) => {
              doc._rev = response._rev;

              Db.connect(config).insertAsync(doc)
                .then((response) => {
                  doc._rev = response.rev;
                  resolve(doc);
                }, reject);
            }, reject);
        });
    });
  }

  static chunkUpdate (config, docs, chunkSize = 1000) {
    return new Promise((resolve, reject) => {
      const chunks = _.chunk(docs, chunkSize);
      const promises = [];

      chunks.forEach((chunk) => {
        promises.push(new Promise((resolve, reject) => {
          Db.connect(config).bulkAsync({
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

  thumbnailSrc (thumbnail, settings, cropSlug, cropDefault) {
    if (!thumbnail) {
      return '';
    }

    let settingsArray;

    if (typeof settings === 'string') {
      settingsArray = settings.split(/,|;/);

      settings = {};

      settingsArray.forEach((setting) => {
        setting = setting.split(/_|:/);

        settings[setting[0]] = setting[1];
      });
    }

    const crop = thumbnail.crops ? thumbnail.crops[cropSlug] : false;

    if (crop) {
      settings.x = crop[0];
      settings.y = crop[1];
      settings.x2 = crop[2];
      settings.y2 = crop[3];
    } else if (cropDefault) {
      settings.g = cropDefault;
    }

    settingsArray = [];

    _.forEach(settings, (value, key) => {
      settingsArray.push([key, value].join(':'));
    });

    const settingsString = settingsArray.join(';');

    if (/image/.test(thumbnail.thumbnailType)) {
      const fileName = thumbnail.fileName;
      const ext = fileName.split('.').pop().toLowerCase();

      if (ext === 'svg') {
        return [this.assistUrl, this.slug, fileName].join('/');
      }

      return [this.assistUrl, this.slug, 'transform', settingsString, fileName].join('/');
    }

    if (/video|embedly|proxy/.test(thumbnail.thumbnailType)) {
      const thumbnailUrl = thumbnail.thumbnailUrl.replace(/https?:\/\//, '');

      return [this.assistUrl, this.slug, 'proxy', 'transform', settingsString, thumbnailUrl].join('/');
    }

    return '';
  }

}

module.exports = Helpers;
