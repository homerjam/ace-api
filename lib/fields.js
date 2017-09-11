const _ = require('lodash');

const fields = [
  {
    type: 'attachment',
    name: 'Attachment',
    dataType: null,
  },
  {
    type: 'audio',
    name: 'Audio',
    dataType: null,
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
    dataType: null,
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
    dataType: null,
  },
  {
    type: 'keyValue',
    name: 'Key Value',
    dataType: null,
  },
  {
    type: 'number',
    name: 'Number',
    dataType: 'number',
  },
  {
    type: 'richText',
    name: 'Rich Text',
    dataType: null,
  },
  {
    type: 'select',
    name: 'Select',
    dataType: 'array',
  },
  {
    type: 'taxonomy',
    name: 'Taxonomy',
    dataType: null,
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
    type: 'video',
    name: 'Video',
    dataType: null,
  },
  {
    type: 'vimeo',
    name: 'Vimeo',
    dataType: null,
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
