const _ = require('lodash');
const Cloudant = require('cloudant');
const Promise = require('bluebird');

const args = process.argv.slice(2);

if (!args[1]) {
  throw Error('No db specified');
}

const cloudant = new Cloudant({
  url: args[0],
});

const fieldDataTypeMap = {
  checkbox: 'boolean',
  date: 'string',
  number: 'number',
  text: 'string',
};

const dbName = args[1];

async function updateClientConfig(dbName) {
  const db = Promise.promisifyAll(cloudant.use(dbName));

  let [generalSettings, fields, actions, schemas, users, taxonomies] = await Promise.all([
    db.getAsync('settings'),
    (await db.viewAsync('admin', 'fieldByKey', { include_docs: true })).rows.map(row => row.doc).filter(doc => !doc.trashed),
    (await db.viewAsync('admin', 'actionByKey', { include_docs: true })).rows.map(row => row.doc).filter(doc => !doc.trashed),
    (await db.viewAsync('admin', 'schemaByKey', { include_docs: true })).rows.map(row => row.doc).filter(doc => !doc.trashed),
    (await db.viewAsync('admin', 'userByKey', { include_docs: true })).rows.map(row => row.doc).filter(doc => !doc.trashed),
    (await db.viewAsync('admin', 'taxonomyByKey', { include_docs: true })).rows.map(row => row.doc).filter(doc => !doc.trashed),
  ]);

  let ecommerceSettings;

  try {
    ecommerceSettings = await db.getAsync('ecommerce.settings');
  } catch (error) {
    //
  }

  fields = fields.map((doc) => {
    doc = _.omit(doc, ['_id', '_rev', 'trashed']);
    doc.type = doc.fieldType;
    delete doc.fieldType;
    if (doc.settings && _.isArray(doc.settings.schemas)) {
      doc.settings.schemas = doc.settings.schemas.map(schema => schema.slug);
    }
    if (doc.settings && doc.settings.taxonomy) {
      doc.settings.taxonomy = doc.settings.taxonomy.slug;
    }
    doc.dataType = fieldDataTypeMap[doc.type];
    return doc;
  });

  actions = actions.map((doc) => {
    doc = _.omit(doc, ['_id', '_rev', 'trashed']);
    doc.type = doc.actionType;
    delete doc.actionType;
    if (!doc.settings) {
      doc.settings = {};
    }
    if (doc.url) {
      doc.settings = {
        url: doc.url,
      };
      delete doc.url;
    }
    return doc;
  });

  schemas = schemas.map((doc) => {
    doc = _.omit(doc, ['_id', '_rev', 'trashed', 'locked', 'type', 'filterFields', 'view', 'titleField', 'slugField', 'notes']);
    if (doc.thumbnailField) {
      doc.thumbnailFields = [doc.thumbnailField];
      delete doc.thumbnailField;
    }
    doc.settings = {
      singular: doc.singular || false,
      hidden: doc.hidden || false,
    };
    delete doc.singular;
    delete doc.hidden;
    return doc;
  });

  const newTaxonomies = taxonomies.map((doc) => {
    doc = _.omit(doc, ['_id', '_rev', 'trashed', 'title', 'createdBy', 'created']);
    doc._id = `taxonomy.${doc.slug}`;
    return doc;
  });

  taxonomies = taxonomies.map((doc) => {
    doc = _.omit(doc, ['_id', '_rev', 'trashed', 'title', 'createdBy', 'created', 'modified', 'modifiedBy', 'type']);
    return doc;
  });

  users = users.map((doc) => {
    doc = _.omit(doc, ['_id', '_rev', 'trashed']);
    delete doc.type;
    doc.id = doc.email;
    return doc;
  });

  const fieldsBySlug = _.reduce(fields, (obj, value) => {
    obj[value.slug] = value;
    return obj;
  }, {});

  const actionsBySlug = _.reduce(actions, (obj, value) => {
    obj[value.slug] = value;
    return obj;
  }, {});

  const updatedSchemas = schemas.map((schema) => {
    if (schema.fields) {
      schema.fields = schema.fields.map((field) => {
        field = fieldsBySlug[field.slug];

        if (!field.settings) {
          field.settings = {};
        }

        if (schema.sortFields) {
          field.settings.gridColumn = schema.sortFields.indexOf(field.slug) !== -1;
        }

        return field;
      });
    }

    delete schema.sortFields;

    if (schema.actions) {
      schema.actions = schema.actions.map(action => actionsBySlug[action.slug]);
    }

    return schema;
  });

  const config = {
    _id: 'config',
    client: {
      name: generalSettings.client.name,
      baseUrl: generalSettings.url,
      metadata: generalSettings.metadata,
      gaView: generalSettings.ga && generalSettings.ga.view ? generalSettings.ga.view : null,
    },
    assets: {
      slug: dbName,
    },
    moduleEnabled: {
      ecommerce: (generalSettings.ecommerce && generalSettings.ecommerce.enabled),
    },
    module: {
      ecommerce: ecommerceSettings ? _.omit(ecommerceSettings, ['_id', '_rev', 'modified', 'modifiedBy', 'stripe']) : null,
    },
    providerEnabled: {
      instagram: !!generalSettings.instagram,
      stripe: !!(ecommerceSettings && ecommerceSettings.stripe),
      vimeo: !!generalSettings.vimeo,
    },
    provider: {
      instagram: generalSettings.instagram || null,
      stripe: ecommerceSettings ? ecommerceSettings.stripe || null : null,
      vimeo: generalSettings.vimeo || null,
    },
    schemas: updatedSchemas,
    users,
    taxonomies,
  };

  // const result1 = await Promise.all(newTaxonomies.map(async (taxonomy) => {
  //   try {
  //     const oldTaxonomy = await db.getAsync(taxonomy._id);
  //     taxonomy._rev = oldTaxonomy._rev;
  //   } catch (error) {
  //     //
  //   }

  //   return db.insertAsync(taxonomy);
  // }));

  // result1.forEach((result, i) => console.log(`${dbName} --> ${newTaxonomies[i].slug} taxonomy updated`));

  try {
    const oldConfig = await db.getAsync('config');
    config._rev = oldConfig._rev;
  } catch (error) {
    //
  }

  const result2 = await db.insertAsync(config);

  if (result2.ok) {
    console.log(`${dbName} --> config updated`);
  }
}

updateClientConfig(dbName);
