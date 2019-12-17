const _ = require('lodash');

const fields = [
  {
    type: 'attachment',
    name: 'Attachment',
    dataType: 'object',
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
  },
  {
    type: 'color',
    name: 'Color',
    dataType: 'string',
  },
  {
    type: 'date',
    name: 'Date',
    dataType: 'string',
  },
  {
    type: 'embedly',
    name: 'Embedly',
    dataType: 'object',
  },
  {
    type: 'entity',
    name: 'Entity',
    dataType: 'array',
  },
  {
    type: 'entityGrid',
    name: 'Entity Grid',
    dataType: 'array',
  },
  {
    type: 'entityTile',
    name: 'Entity Tile',
    dataType: 'array',
  },
  {
    type: 'image',
    name: 'Image',
    dataType: 'object',
  },
  {
    type: 'keyValue',
    name: 'Key Value',
    dataType: 'object',
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
  },
  {
    type: 'select',
    name: 'Select',
    dataType: 'array',
  },
  {
    type: 'taxonomy',
    name: 'Taxonomy',
    dataType: 'object',
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
  },
  {
    type: 'video',
    name: 'Video',
    dataType: 'object',
  },
  {
    type: 'vimeo',
    name: 'Vimeo',
    dataType: 'object',
  },
];

class Fields {
  static fields() {
    return fields.map(field => Object.freeze(field));
  }
  static field(type) {
    return _.find(Fields.fields(), { type });
  }
}

module.exports = Fields;
