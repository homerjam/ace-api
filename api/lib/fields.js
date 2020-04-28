const _ = require('lodash');
const htmlToText = require('html-to-text');
const dayjs = require('dayjs');
const Entity = require('./entity');
const Helpers = require('./helpers');

class Fields {
  static all() {
    return Fields.fields.map((field) => Object.freeze(field));
  }

  static find(type) {
    return _.find(Fields.all(), { type });
  }

  static toText(field, schemaField) {
    if (!field || field.value === undefined || field.value === null) {
      return '';
    }

    const config = Fields.find(schemaField.type);

    if (config.toText) {
      return config.toText(field.value) || '';
    }

    return field.value;
  }

  static toThumbnail(field, schemaField, clientConfig) {
    if (!field || field.value === undefined || field.value === null) {
      return undefined;
    }

    const config = Fields.find(schemaField.type);

    if (config.toThumbnail) {
      const thumbnail =
        config.toThumbnail(field.value, clientConfig) || undefined;

      if (thumbnail && thumbnail.width && thumbnail.height) {
        thumbnail.ratio = _.round(thumbnail.width / thumbnail.height, 5);
      }

      return thumbnail;
    }

    return undefined;
  }

  static toDb(field, schemaField) {
    if (!field || field.value === undefined || field.value === null) {
      return undefined;
    }

    const config = Fields.find(schemaField.type);

    if (config.toDb) {
      return config.toDb(field.value, schemaField.settings) || undefined;
    }

    return field.value;
  }

  static fields = [
    {
      type: 'attachment',
      name: 'Attachment',
      dataType: 'object',
      toText(value) {
        return _.get(value, ['original', 'fileName']);
      },
    },
    {
      type: 'audio',
      name: 'Audio',
      dataType: 'object',
    },
    {
      type: 'checkbox',
      name: 'Checkbox',
      dataType: 'boolean',
      toText(value) {
        return value ? '✅' : '❎';
      },
    },
    {
      type: 'color',
      name: 'Color',
      dataType: 'string',
    },
    {
      type: 'date',
      name: 'Date',
      dataType: 'number',
      toText(value) {
        return dayjs(value).format('YYYY-MM-DD');
      },
      toDb(value) {
        return JSON.stringify(value).replace(/"/g, '');
      },
    },
    {
      type: 'embedly',
      name: 'Embedly',
      dataType: 'object',
      toText(value) {
        return value.url;
      },
      toThumbnail(value) {
        if (!value.oembed) {
          return null;
        }

        const thumbnail = {
          thumbnailType: 'oembed',
          url: value.oembed.thumbnail_url,
          width: value.oembed.thumbnail_width,
          height: value.oembed.thumbnail_height,
          oembed: value.oembed,
        };

        if (thumbnail.oembed) {
          thumbnail.oembed.ratio = value.oembed.width / value.oembed.height;
        }

        return thumbnail;
      },
    },
    {
      type: 'entity',
      name: 'Entity',
      dataType: 'array',
      toText(value) {
        if (_.isArray(value)) {
          return value
            .slice(0, 1)
            .filter((entity) => entity)
            .map((entity) => entity.title)
            .join(', ');
        }
        if (_.isObject(value)) {
          return value.title;
        }
        return value;
      },
      toThumbnail(value, clientConfig) {
        return Entity.thumbnail(value[0], clientConfig);
      },
      toDb(value, settings) {
        value = _.isArray(value) ? value : [value];

        value = value.filter((entity) => entity);

        value = value.map((entity) => {
          const entityRef = {
            id: entity._id || entity.id,
            type: 'entity',
            schema: entity.schema,
            title: entity.title,
            slug: entity.slug,
            published: entity.published,
            thumbnail: entity.thumbnail,
          };

          if (entity.fields) {
            // entityRef.thumbnail = EntityFactory.getEntityThumbnail(entity);
          }

          if (settings.groupEnabled) {
            entityRef.groupBefore = entity.groupBefore || false;
            entityRef.groupAfter = entity.groupAfter || false;
          }

          return entityRef;
        });

        return value;
      },
    },
    {
      type: 'entityGrid',
      name: 'Entity Grid',
      dataType: 'array',
      toText(value) {
        return Fields.find('entity').toText(value);
      },
      toThumbnail(value, clientConfig) {
        return Fields.find('entity').toThumbnail(value, clientConfig);
      },
      toDb(value, settings) {
        return Fields.find('entity').toDb(value, settings);
      },
    },
    {
      type: 'entityTile',
      name: 'Entity Tile',
      dataType: 'array',
      toText(value) {
        return Fields.find('entity').toText(value);
      },
      toThumbnail(value, clientConfig) {
        return Fields.find('entity').toThumbnail(value, clientConfig);
      },
      toDb(value, settings) {
        return Fields.find('entity').toDb(value, settings);
      },
    },
    {
      type: 'image',
      name: 'Image',
      dataType: 'object',
      toText(value) {
        return _.get(value, ['original', 'fileName']);
      },
      toThumbnail(value) {
        const fileName =
          value.fileName ||
          (value.name || value.file.name) + (value.ext || value.file.ext);

        const thumbnail = {
          thumbnailType: 'image',
          fileName,
          name: value.name || value.file.name,
          ext: value.ext || value.file.ext,
          width: value.metadata ? value.metadata.width || 0 : value.width || 0,
          height: value.metadata
            ? value.metadata.height || 0
            : value.height || 0,
        };

        if (value.crops) {
          thumbnail.crops = value.crops;
        }
        if (value.dzi) {
          thumbnail.dzi = value.dzi;
        }

        return thumbnail;
      },
    },
    {
      type: 'keyValue',
      name: 'Key Value',
      dataType: 'object',
      toText(value) {
        if (_.isArray(value)) {
          return value
            .filter((obj) => obj)
            .map((obj) => `${obj.key}: ${obj.value}`)
            .join(', ');
        }
      },
    },
    {
      type: 'number',
      name: 'Number',
      dataType: 'number',
    },
    {
      type: 'richText',
      name: 'Rich Text',
      dataType: 'object',
      toText(value) {
        return htmlToText.fromString(value.html);
      },
      toDb(value) {
        const html = Helpers.cleanHtml(value.html);
        let entities = [];

        const pattern = 'href=["\']urn:entity:(\\S+)["\']';

        const matchStrings = html.match(new RegExp(pattern, 'gim'));

        if (matchStrings) {
          entities = matchStrings.map((matchString) => {
            return {
              id: new RegExp(pattern, 'i').exec(matchString)[1],
            };
          });
        }

        return {
          html,
          entities,
        };
      },
    },
    {
      type: 'select',
      name: 'Select',
      dataType: 'array',
      toText(value) {
        if (_.isArray(value)) {
          return value
            .filter((option) => option)
            .map((option) => option.title)
            .join(', ');
        }

        if (_.isObject(value)) {
          return value.title;
        }

        return value;
      },
    },
    {
      type: 'taxonomy',
      name: 'Taxonomy',
      dataType: 'object',
      toText(value) {
        if (_.isArray(value.terms)) {
          return value.terms
            .filter((term) => term)
            .map((term) => term.title)
            .join(', ');
        }

        return value;
      },
      toDb(value, settings) {
        if (!_.isArray(value.terms) || !value.terms.length) {
          return {
            taxonomy: settings.taxonomy,
            terms: [],
          };
        }

        const terms = value.terms.map((term) => {
          term.slug = _.kebabCase(term.title);
          term.parents = (term.parents || []).map((parentTerm) => {
            parentTerm.slug = _.kebabCase(parentTerm.title);
            return _.pick(parentTerm, ['id', 'title', 'slug']);
          });
          return _.pick(term, ['id', 'title', 'slug', 'parents']);
        });

        return {
          taxonomy: settings.taxonomy,
          terms,
        };
      },
    },
    {
      type: 'text',
      name: 'Text',
      dataType: 'string',
    },
    {
      type: 'textArea',
      name: 'Text Area',
      dataType: 'string',
    },
    {
      type: 'user',
      name: 'User',
      dataType: 'array',
      toText(value) {
        if (_.isArray(value)) {
          return value
            .filter((user) => user)
            .map((user) => user.title)
            .join(', ');
        }

        if (_.isObject(value)) {
          return value.title;
        }

        return value;
      },
    },
    {
      type: 'video',
      name: 'Video',
      dataType: 'object',
      toText(value) {
        return _.get(value, ['original', 'fileName']);
      },
      toThumbnail(value) {
        const fileName =
          value.fileName ||
          (value.name || value.file.name) + (value.ext || value.file.ext);

        const thumbnail = {
          thumbnailType: 'video',
          fileName,
          name: value.name || value.file.name,
          ext: value.ext || value.file.ext,
          width: value.metadata ? value.metadata.width || 0 : value.width || 0,
          height: value.metadata
            ? value.metadata.height || 0
            : value.height || 0,
          duration: value.metadata
            ? value.metadata.duration || 0
            : value.duration || 0,
        };

        return thumbnail;
      },
    },
    {
      type: 'vimeo',
      name: 'Vimeo',
      dataType: 'object',
      toText(value) {
        return value.url;
      },
      toThumbnail(value) {
        if (!value.video) {
          return null;
        }

        const thumbnail = {
          thumbnailType: 'oembed', // TODO: change thumbnailType: 'oembed' to 'embed:vimeo' ?
          url: value.video.thumbnail.url,
          width: value.video.thumbnail.width,
          height: value.video.thumbnail.height,
          vimeo: value.video,
        };

        return thumbnail;
      },
    },
  ];
}

module.exports = Fields;
