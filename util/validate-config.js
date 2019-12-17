const fs = require('fs');
const Validator = require('jsonschema').Validator;

const v = new Validator();

const slug = process.argv.slice(3)[0];

const config = JSON.parse(fs.readFileSync('config/' + slug + '.json'));

const client = {
  id: '/client',
  type: 'object',
  properties: {
    name: { type: 'string', required: true },
    baseUrl: { type: 'string', required: true },
    metadata: {
      type: 'object',
      required: true,
      properties: {
        description: { type: 'string', required: true },
      },
    },
    gaView: { type: 'string', required: true },
  },
};

const schema = {
  id: '/schema',
  type: 'object',
  properties: {
    name: { type: 'string', required: true },
    collectionName: { type: 'string' },
    slug: { type: 'string', required: true },
    settings: {
      type: 'object',
      required: true,
      properties: {
        singular: { type: 'boolean' },
        hidden: { type: 'boolean' },
      },
    },
    actions: {
      type: 'array',
      items: { $ref: '/action' },
    },
    fields: {
      type: 'array',
      required: true,
      items: { $ref: '/field' },
    },
    thumbnailFields: {
      type: 'array',
      items: { type: 'string' },
    },
    titleTemplate: { type: 'string' },
    slugTemplate: { type: 'string' },
  },
};

const field = {
  id: '/field',
  type: 'object',
  properties: {
    name: { type: 'string', required: true },
    slug: { type: 'string', required: true },
    type: {
      type: 'string',
      required: true,
      enum: [
        'attachment',
        'audio',
        'checkbox',
        'color',
        'date',
        'embedly',
        'entity',
        'entityGrid',
        'entityTile',
        'image',
        'keyValue',
        'number',
        'richText',
        'select',
        'taxonomy',
        'text',
        'textArea',
        'user',
        'video',
        'vimeo',
      ],
    },
    dataType: {
      type: 'string',
      required: true,
      enum: ['string', 'number', 'boolean', 'object', 'array'],
    },
    settings: {
      type: 'object',
      required: true,
      properties: {
        gridColumn: { type: 'boolean' },
        required: { type: 'boolean' },
        minWidth: { type: 'integer', minimum: 0 },
        minHeight: { type: 'integer', minimum: 0 },
        maxWidth: { type: 'integer', minimum: 0 },
        maxHeight: { type: 'integer', minimum: 0 },
        dzi: { type: 'boolean' },
        crops: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', required: true },
              slug: { type: 'string', required: true },
              ratio: { type: 'number', required: true, minimum: 0 },
              minWidth: { type: 'integer', required: true, minimum: 0 },
              minHeight: { type: 'integer', required: true, minimum: 0 },
              gravity: {
                type: 'string',
                required: true,
                pattern: /center|north/i,
              },
            },
          },
        },
        schemas: { type: 'array', items: { type: 'string ' } },
        groupEnabled: { type: 'boolean' },
        groupSizeLimit: { type: 'integer', minimum: 0 },
        options: { type: 'array', items: { type: 'string' } },
        taxonomy: { type: 'string' },
        multiple: { type: 'boolean' },
        existingOnly: { type: 'boolean' },
      },
    },
  },
};

const action = {
  id: '/action',
  type: 'object',
  properties: {
    name: { type: 'string', required: true },
    slug: { type: 'string', required: true },
    type: { type: 'string', required: true, enum: ['url'] },
    settings: {
      type: 'object',
      required: true,
      properties: {
        url: { type: 'string' },
      },
    },
  },
};

const user = {
  id: '/user',
  type: 'object',
  properties: {
    id: { type: 'string', required: true },
    email: { type: 'string', required: true, format: 'email' },
    firstName: { type: 'string', required: true },
    lastName: { type: 'string', required: true },
    role: {
      type: 'string',
      required: true,
      enum: ['admin', 'editor', 'guest'],
    },
    active: { type: 'boolean', required: true },
  },
};

const configSchema = {
  id: '/config',
  type: 'object',
  properties: {
    _id: { type: 'string', required: true, enum: ['config'] },
    _rev: { type: 'string' },
    slug: { type: 'string', required: true },
    client: { $ref: '/client', required: true },
    assets: {
      type: 'object',
      required: true,
      properties: { slug: { type: 'string', required: true } },
    },
    schemas: {
      type: 'array',
      required: true,
      items: { $ref: '/schema' },
    },
    taxonomies: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', required: true },
          slug: { type: 'string', required: true },
        },
      },
    },
    users: {
      type: 'array',
      required: true,
      items: { $ref: '/user' },
    },
    userSettings: {
      type: 'object',
      patternProperties: {
        '.*': {
          type: 'object',
          properties: {
            provider: {
              type: 'object',
              properties: {
                instagram: { type: ['object', null] },
              },
            },
          },
        },
      },
    },
    provider: {
      type: 'object',
      properties: {
        instagram: { type: ['object', null] },
        google: { type: ['object', null] },
        vimeo: { type: ['object', null] },
      },
    },
    providerEnabled: {
      type: 'object',
      properties: {
        instagram: { type: 'boolean' },
        vimeo: { type: 'boolean' },
      },
    },
  },
};

v.addSchema(client, '/client');
v.addSchema(schema, '/schema');
v.addSchema(field, '/field');
v.addSchema(action, '/action');
v.addSchema(user, '/user');

v.validate(config, configSchema, { throwError: true });

console.log(slug, 'config valid');
