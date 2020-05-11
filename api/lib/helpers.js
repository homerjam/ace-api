const _ = require('lodash');
class Helpers {
  constructor(config) {
    this.config = config;
    this.assistUrl = config.assist.url;
    this.slug = config.slug;
  }

  static groupEntities(entities, groupSize = Infinity) {
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

  thumbnailSrc(thumbnail, settings, cropSlug, cropDefault) {
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

    if (/(image)/.test(thumbnail.thumbnailType)) {
      if (thumbnail.ext === 'svg') {
        return [this.assistUrl, this.slug, thumbnail.name + thumbnail.ext].join(
          '/'
        );
      }

      return [
        this.assistUrl,
        this.slug,
        'transform',
        settingsString,
        thumbnail.name + thumbnail.ext,
      ].join('/');
    }

    if (/(video)/.test(thumbnail.thumbnailType)) {
      return [
        this.assistUrl,
        this.slug,
        'transform',
        settingsString,
        thumbnail.name,
        'thumb.jpg',
      ].join('/');
    }

    if (/(oembed|proxy)/.test(thumbnail.thumbnailType)) {
      const thumbnailUrl = thumbnail.thumbnailUrl.replace(/https?:\/\//, '');

      return [
        this.assistUrl,
        this.slug,
        'proxy',
        'transform',
        settingsString,
        thumbnailUrl,
      ].join('/');
    }

    return '';
  }
}

module.exports = Helpers;
