const Validator = require('jsonschema').Validator;

class ConfigValidator {
  constructor() {
    this.v = new Validator();

    const client = {
      id: '/client',
      type: 'object',
      properties: {
        slug: { type: 'string' },
        name: { type: 'string' },
        baseUrl: { type: 'string' },
      },
      additionalProperties: false,
      required: ['slug', 'name', 'baseUrl'],
    };

    const schema = {
      id: '/schema',
      type: 'object',
      properties: {
        slug: { type: 'string' },
        name: { type: 'string' },
        collectionName: { type: 'string' },
        settings: {
          type: 'object',
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
          items: { $ref: '/field' },
        },
        thumbnailFields: {
          type: 'array',
          items: { type: 'string' },
        },
        slugTemplate: { type: 'string' },
        titleTemplate: { type: 'string' },
      },
      additionalProperties: false,
      required: ['slug', 'name', 'settings', 'fields'],
    };

    const field = {
      id: '/field',
      type: 'object',
      properties: {
        name: { type: 'string' },
        slug: { type: 'string' },
        type: {
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
            'select',
            'taxonomy',
            'text',
            'textArea',
            'textRich',
            'user',
            'video',
            'vimeo',
          ],
        },
        settings: {
          type: 'object',
          properties: {
            display: {
              type: 'object',
              properties: {
                sort: { type: 'boolean' },
                tile: { type: 'boolean' },
              },
            },
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
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  ratio: { type: 'number', minimum: 0 },
                  minWidth: { type: 'integer', minimum: 0 },
                  minHeight: { type: 'integer', minimum: 0 },
                  gravity: {
                    type: 'string',
                    regexp: '/center|north/i',
                  },
                },
                required: [
                  'name',
                  'slug',
                  'ratio',
                  'minWidth',
                  'minHeight',
                  'gravity',
                ],
              },
            },
            schemas: { type: 'array', items: { type: 'string' } },
            groupEnabled: { type: 'boolean' },
            groupSizeLimit: { type: 'integer', minimum: 0 },
            options: { type: 'array', items: { type: 'string' } },
            taxonomy: { type: 'string' },
            multiple: { type: 'boolean' },
            existingOnly: { type: 'boolean' },
          },
        },
      },
      additionalProperties: false,
      required: ['slug', 'name', 'type', 'settings'],
    };

    const action = {
      id: '/action',
      type: 'object',
      properties: {
        slug: { type: 'string' },
        name: { type: 'string' },
        type: {
          enum: ['url'],
        },
        settings: {
          type: 'object',
          properties: {
            url: { type: 'string' },
          },
        },
      },
      additionalProperties: false,
      required: ['slug', 'name', 'type', 'settings'],
    };

    // const user = {
    //   id: '/user',
    //   type: 'object',
    //   properties: {
    //     id: { type: 'string' },
    //     email: { type: 'string', format: 'email' },
    //     firstName: { type: 'string' },
    //     lastName: { type: 'string' },
    //     role: {
    //       enum: ['admin', 'editor', 'guest'],
    //     },
    //     active: { type: 'boolean' },
    //   },
    //   additionalProperties: false,
    //   required: ['id', 'email', 'firstName', 'lastName', 'role', 'active'],
    // };

    this.configSchema = {
      id: '/config',
      type: 'object',
      properties: {
        // _id: {
        //   enum: ['config'],
        // },
        // _rev: { type: 'string' },
        client: { $ref: '/client' },
        assets: {
          type: 'object',
          properties: { slug: { type: 'string' } },
          additionalProperties: false,
          required: ['slug'],
        },
        schemas: {
          type: 'array',
          items: { $ref: '/schema' },
        },
        taxonomies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              slug: { type: 'string' },
              name: { type: 'string' },
            },
            additionalProperties: false,
            required: ['slug', 'name'],
          },
        },
        // users: {
        //   type: 'array',
        //   items: { $ref: '/user' },
        // },
        // userSettings: {
        //   type: 'object',
        //   patternProperties: {
        //     '.*': {
        //       type: 'object',
        //       properties: {
        //         provider: {
        //           type: 'object',
        //           properties: {
        //             instagram: { type: ['object', 'null'] },
        //             spotify: { type: ['object', 'null'] },
        //           },
        //         },
        //       },
        //     },
        //   },
        // },
        // provider: {
        //   type: 'object',
        //   properties: {
        //     google: { type: ['object', 'null'] },
        //     instagram: { type: ['object', 'null'] },
        //     spotify: { type: ['object', 'null'] },
        //     vimeo: { type: ['object', 'null'] },
        //   },
        // },
        providerEnabled: {
          type: 'object',
          properties: {
            google: { type: 'boolean' },
            instagram: { type: 'boolean' },
            spotify: { type: 'boolean' },
            vimeo: { type: 'boolean' },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
      required: [
        // '_id',
        // '_rev',
        'client',
        'assets',
        'schemas',
        'taxonomies',
        // 'users',
      ],
    };

    this.configSchemaRefs = {
      '/client': client,
      '/schema': schema,
      '/field': field,
      '/action': action,
      // '/user': user,
    };

    this.v.addSchema(client, '/client');
    this.v.addSchema(schema, '/schema');
    this.v.addSchema(field, '/field');
    this.v.addSchema(action, '/action');
    // this.v.addSchema(user, '/user');
  }

  schema() {
    return this.configSchema;
  }

  refs() {
    return this.configSchemaRefs;
  }

  validate(config, options) {
    return this.v.validate(config, this.configSchema, options);
  }
}

module.exports = ConfigValidator;
