const _ = require('lodash');
const Cloudant = require('cloudant');
const Promise = require('bluebird');

const args = process.argv.slice(2);

const cloudant = new Cloudant({
  url: process.env.DB_URL,
});

args.forEach(async (dbName) => {
  const db = Promise.promisifyAll(cloudant.use(dbName));

  let [generalSettings, ecommerceSettings, fields, actions, schemas, users, taxonomies] = await Promise.all([
    db.getAsync('settings'),
    db.getAsync('ecommerce.settings'),
    (await db.viewAsync('admin', 'fieldByKey', { include_docs: true })).rows.map(row => row.doc).filter(doc => !doc.trashed),
    (await db.viewAsync('admin', 'actionByKey', { include_docs: true })).rows.map(row => row.doc).filter(doc => !doc.trashed),
    (await db.viewAsync('admin', 'schemaByKey', { include_docs: true })).rows.map(row => row.doc).filter(doc => !doc.trashed),
    (await db.viewAsync('admin', 'userByKey', { include_docs: true })).rows.map(row => row.doc).filter(doc => !doc.trashed),
    (await db.viewAsync('admin', 'taxonomyByKey', { include_docs: true })).rows.map(row => row.doc).filter(doc => !doc.trashed),
  ]);

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
    return doc;
  });

  actions = actions.map((doc) => {
    doc = _.omit(doc, ['_id', '_rev', 'trashed']);
    doc.type = doc.actionType;
    delete doc.actionType;
    return doc;
  });

  schemas = schemas.map((doc) => {
    doc = _.omit(doc, ['_id', '_rev', 'trashed', 'locked', 'type', 'filterFields', 'view', 'titleField', 'slugField', 'notes']);
    if (doc.thumbnailField) {
      doc.thumbnailField = [doc.thumbnailField];
    }
    if (doc.sortFields) {
      doc.gridColumns = doc.sortFields;
      delete doc.sortFields;
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
      schema.fields = schema.fields.map(field => fieldsBySlug[field.slug]);
    }
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
    moduleEnabled: {
      ecommerce: (generalSettings.ecommerce && generalSettings.ecommerce.enabled),
    },
    module: {
      ecommerce: _.omit(ecommerceSettings, ['_id', '_rev', 'modified', 'modifiedBy', 'stripe']),
    },
    providerEnabled: generalSettings.providers,
    provider: {
      instagram: generalSettings.instagram || false,
      stripe: ecommerceSettings.stripe || false,
      vimeo: generalSettings.vimeo || false,
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
});
