const _ = require('lodash');
const jsonQuery = require('json-query');
const { diff } = require('deep-diff');
const he = require('he');
const Handlebars = require('handlebars');
const ClientConfig = require('./client-config');
const Db = require('./db');
const Fields = require('./fields');
const Helpers = require('./helpers');
const Schema = require('./schema');
const Assist = require('./assist');

class Entity {
  constructor(config) {
    this.config = config;
  }

  static flattenValues(docs) {
    return docs.map((doc) => {
      if (!doc.fields || !_.size(doc.fields)) {
        return doc;
      }

      doc.fields = _.mapValues(doc.fields, (field) => {
        if (/entity/.test(field.type) && _.isArray(field.value)) {
          // entity / entityTile / entityGrid
          field.value = Entity.flattenValues(field.value);
        }
        return field.value;
      });

      return doc;
    });
  }

  static _mapEntities(entities = []) {
    return _.reduce(
      _.isArray(entities) ? entities : [entities],
      (result, value) => {
        const id = value._id;
        if (!id) {
          throw Error('Entity requires `_id`');
        }
        result[id] = value;
        return result;
      },
      {}
    );
  }

  static _filterEntityFields(docs, role = 'guest') {
    const isArray = _.isArray(docs);

    docs = (isArray ? docs : [docs]).map((doc) => {
      if (_.size(doc.fields)) {
        doc.fields = _.mapValues(doc.fields, (field) => {
          if (_.isArray(field.value)) {
            field.value = field.value.filter((obj) => {
              if (!obj) {
                return false;
              }
              if (obj.type && obj.type === 'entity' && role === 'guest') {
                return obj.published !== undefined ? obj.published : true;
              }
              return true;
            });
          }
          return field;
        });
      }
      return doc;
    });

    return isArray ? docs : docs[0];
  }

  static _appendChildren(docs, childrenMap) {
    return docs.map((doc) => {
      if (!_.size(doc.fields)) {
        return doc;
      }

      doc.fields = _.mapValues(doc.fields, (field) => {
        if (_.isArray(field.value)) {
          field.value = field.value.filter((obj) => {
            if (!obj) {
              return false;
            }
            if (obj.type === 'entity') {
              return childrenMap[obj.id] !== undefined;
            }
            return true;
          });

          field.value = field.value.map((obj) => {
            if (obj.type === 'entity') {
              obj = _.merge(obj, childrenMap[obj.id]);
            }
            obj = _.omitBy(obj, (value, key) => key.startsWith('_'));
            return obj;
          });
        }

        return field;
      });

      return doc;
    });
  }

  static _appendParentEntities(rows, parents = false, role = 'guest') {
    let entityMap = {};

    rows.forEach((row) => {
      if (row.doc && row.value.type === 'entity') {
        entityMap[row.id] = { ...row.doc, parents: [] };
      }
    });

    if (parents) {
      rows.forEach((row) => {
        if (row.doc && row.value.type === 'parent') {
          entityMap[row.key].parents.push(
            Entity._filterEntityFields(row.doc, role)
          );
        }
      });

      entityMap = _.mapValues(entityMap, (entity) => {
        entity.parents = _.uniqBy(entity.parents, (entity) => entity._id);
        return entity;
      });
    }

    rows = rows.map((row) => {
      row.doc = entityMap[row.id];
      return row;
    });

    rows = rows.filter((row) => row.value.type === 'entity');

    return rows;
  }

  static _fileNames(entities) {
    const fileNames = [];

    entities.forEach((entity) => {
      _.forEach(entity.fields, (field) => {
        if (field.value && field.value.file) {
          fileNames.push(field.value.file.name);
        }
      });
    });

    return _.uniq(fileNames);
  }

  _templateString(entity, schema, template) {
    let string;

    // Grab template, fallback to first field
    template = template
      ? template
      : schema.settings.singular
      ? schema.name
      : `{{${schema.fields[0].slug}}}`;

    // Convert fields to text
    const fields = _.mapValues(entity.fields, (field, fieldSlug) => {
      const schemaField = _.find(schema.fields, { slug: fieldSlug });
      return Fields.toText(field, schemaField);
    });

    // Compile templates
    string = Handlebars.compile(template)(fields);

    // Trim dashes
    string = string
      .replace(/^(-|–|—|\/|:|\s)+/, '')
      .replace(/(-|–|—|\/|:|\s)+$/, '');

    // Decode entities
    string = he.decode(string);

    return string;
  }

  _prepEntity(entity, clientConfig) {
    entity = _.pick(entity, [
      '_id',
      '_rev',
      'type',
      'schema',
      'title',
      'slug',
      'fields',
      'createdAt',
      'createdBy',
      'modifiedAt',
      'modifiedBy',
      'published',
      'publishedAt',
      'thumbnail',
    ]);

    const schema = _.find(clientConfig.schemas, { slug: entity.schema });

    if (!schema) {
      throw Error('Schema not found');
    }

    entity.type = 'entity';

    entity.schema = schema.slug;

    const now = Helpers.now();

    if (!entity.createdAt) {
      entity.createdAt = now;
    }
    if (!entity.createdBy) {
      entity.createdBy = this.config.userId;
    }

    entity.modifiedAt = now;
    entity.modifiedBy = this.config.userId;

    if (entity.published) {
      // entity.publishedAt = JSON.stringify(entity.publishedAt).replace(/"/g, '');
    }

    entity.title = this._templateString(entity, schema, schema.titleTemplate);

    entity.slug = this._templateString(entity, schema, schema.slugTemplate);
    entity.slug = _.kebabCase(entity.slug);

    entity.thumbnail = Fields.thumbnailFields(entity, clientConfig)[0];

    entity.fields = _.mapValues(entity.fields, (field, fieldSlug) => {
      const schemaField = _.find(schema.fields, { slug: fieldSlug });

      if (!schemaField) {
        return null;
      }

      field.type = schemaField.type;
      field.fieldType = schemaField.type; // TODO: remove fieldType

      field.value = Fields.toDb(field, schemaField);

      return field;
    });

    entity.fields = _.pickBy(entity.fields, (field) => field);

    return entity;
  }

  async fieldValues(fieldSlug, searchTerm) {
    const result = await Db.connect(this.config).viewWithList(
      'entity',
      'byField',
      'search',
      {
        startkey: [fieldSlug],
        endkey: [fieldSlug, {}],
        group: true,
        searchTerm,
      }
    );
    return result;
  }

  // TODO: document json query use
  static _jsonQuery(data, queryString, isFieldJsonQuery = false) {
    queryString = queryString.replace(/(\s\s|\t|\r|\n)/g, '');

    if (isFieldJsonQuery) {
      const queryParts = queryString.trim().split(/\[|\]/);
      const selector = `fields.${queryParts[0]}.value[${queryParts[1] || '*'}]`;
      const modifier = /\]:/.test(queryString)
        ? `:${queryString.split(/\]:/).slice(-1)[0].trim()}`
        : '';
      queryString = `${selector}${modifier}`;
    }

    const result = jsonQuery(queryString, {
      data,
      locals: {
        slice: (input, start, end) => _.slice(input, start, end),
        sample: (input, size = 1) => _.sampleSize(input, size),
        group: (entities, groupSize = Infinity) => {
          const grouped = [];

          let group = [];

          entities.forEach((entity) => {
            if (!entity.groupBefore || group.length >= groupSize) {
              group = [];
            }

            group.push(entity);

            if (!entity.groupAfter || group.length >= groupSize) {
              group.ratio = 0;

              group.forEach((entity) => {
                group.ratio += (entity.thumbnail || entity).ratio;
              });

              group.forEach((entity) => {
                entity.groupRatio =
                  (entity.thumbnail || entity).ratio / group.ratio;
              });

              grouped.push(group);
            }
          });

          return grouped;
        },
        pick: (input, ...paths) =>
          _.map(input, (obj) => {
            const copy = {
              id: obj.id || undefined,
            };
            paths = paths.filter((path) => path); // Remove empty paths (tolerate trailing comma in args)
            paths.forEach((path) => {
              const pathParts = path.match(/([^\s]+)/g);
              const pathFrom = pathParts[0];
              const pathTo = pathParts[pathParts.length - 1];
              _.set(copy, pathTo, _.get(obj, pathFrom));
            });
            return copy;
          }),
      },
      allowRegexp: true,
    });

    return result;
  }

  static _splitJsonQueries(queriesString) {
    // Remove white space
    queriesString = queriesString.replace(/(\s\s|\t|\r|\n)/gm, '');

    // Match and store (...args) from query so we can split by comma
    const methodArgs = queriesString.match(/\(([^)]+)\)/g);

    // Replace (...args) with empty ()
    queriesString = queriesString.replace(/\(.*?\)/g, '()');

    // Extract queries
    let queryStrings = queriesString.split(/,(?![^([]*[\])])/g);

    queryStrings = queryStrings.map((queryString) => {
      // Replace () with original (...args)
      const emptyArgs = queryString.match(/\(\)/g);
      if (emptyArgs) {
        _.times(emptyArgs.length, () => {
          queryString = queryString.replace('()', methodArgs.splice(0, 1));
        });
      }
      return queryString.trim();
    });

    return queryStrings;
  }

  async _entitiesById(ids = [], options = {}) {
    options = _.merge(
      {
        parents: false,
        role: 'guest',
      },
      options
    );

    const queryParams = {
      include_docs: true,
    };

    if (ids.length) {
      queryParams.keys = ids;
    }

    const result = await Db.connect(this.config).view(
      'entity',
      options.parents ? 'byIdExtended' : 'byId',
      queryParams
    );

    result.rows = result.rows.map((row) => {
      row.doc = Entity._filterEntityFields(row.doc, options.role);
      return row;
    });

    result.rows = Entity._appendParentEntities(
      result.rows,
      options.parents,
      options.role
    );

    return result;
  }

  static _childEntitiesDepthLimit(children) {
    let limit = 0;
    if (_.isNumber(children)) {
      limit = children - 1;
    }
    if (_.isArray(children)) {
      limit = children.length - 1;
    }
    return limit;
  }

  async _mapDocs(rowsOrDocs, docMap = {}, options = {}) {
    options._childDepth = options._childDepth || 0;

    if (!options.parents && !options.children) {
      return docMap;
    }

    let ids = [];
    let childIds = [];

    rowsOrDocs.forEach((rowOrDoc) => {
      const isRow = !!rowOrDoc.doc;

      let doc = isRow ? rowOrDoc.doc : rowOrDoc;

      doc = Entity._filterEntityFields(doc, options.role);

      if (options.children && doc.fields && _.size(doc.fields)) {
        if (_.isArray(options.children)) {
          Entity._splitJsonQueries(
            options.children[options._childDepth]
          ).forEach((queryString) => {
            childIds = childIds.concat(
              _.flatten(Entity._jsonQuery(doc, queryString, true).value).map(
                (obj) => obj && obj.id
              )
            );
          });
        } else {
          _.forEach(doc.fields, (field) => {
            if (_.isArray(field.value)) {
              field.value = field.value.filter((obj) => obj);

              field.value.forEach((obj) => {
                if (obj.id) {
                  childIds.push(obj.id);
                }
              });
            }
          });
        }
      }

      ids.push(isRow ? rowOrDoc.id : doc._id || doc.id);
    });

    ids = _.uniq(ids);
    ids = ids.filter((id) => !docMap[id]);

    let docs = [];
    if (ids.length > 0) {
      docs = (await this._entitiesById(ids, options)).rows.map(
        (row) => row.doc
      );

      docs.forEach((doc) => {
        docMap[doc._id] = doc;
      });
    }

    childIds = _.uniq(childIds);
    childIds = childIds.filter((id) => !docMap[id]);

    let childDocs = [];
    if (childIds.length > 0) {
      childDocs = (
        await this._entitiesById(childIds, { ...options, parents: false })
      ).rows.map((row) => row.doc);

      childDocs.forEach((doc) => {
        docMap[doc._id] = doc;
      });
    }

    if (
      !options.children ||
      options._childDepth === Entity._childEntitiesDepthLimit(options.children)
    ) {
      return docMap;
    }

    docMap = await this._mapDocs(childDocs, docMap, {
      ...options,
      parents: false,
      _childDepth: options._childDepth + 1,
    });

    return docMap;
  }

  static _mergeDocs(
    docs,
    docMap,
    options = { children: false, parents: false }
  ) {
    options._childDepth = options._childDepth || 0;

    if (
      options.children &&
      options._childDepth - 1 ===
        Entity._childEntitiesDepthLimit(options.children)
    ) {
      return docs;
    }

    docs = docs.map((rowOrDoc) => {
      const isRow = !!rowOrDoc.doc;

      let doc = isRow ? rowOrDoc.doc : rowOrDoc;

      if (docMap[rowOrDoc.id || rowOrDoc._id]) {
        doc = _.merge({}, doc, docMap[rowOrDoc.id || rowOrDoc._id]);
      }

      if (options.children && doc.fields && _.size(doc.fields)) {
        let fieldJsonQueryMap;

        if (_.isArray(options.children)) {
          fieldJsonQueryMap = {};
          Entity._splitJsonQueries(
            options.children[options._childDepth]
          ).forEach((queryString) => {
            const key = queryString.split(/\[|\]/)[0];
            fieldJsonQueryMap[key] = queryString;
          });
        }

        doc.fields = _.mapValues(doc.fields, (field, fieldSlug) => {
          if (_.isArray(field.value)) {
            field.value = field.value.filter((obj) => obj);

            if (
              !fieldJsonQueryMap ||
              (fieldJsonQueryMap && fieldJsonQueryMap[fieldSlug])
            ) {
              if (fieldJsonQueryMap && fieldJsonQueryMap[fieldSlug]) {
                field.value = field.value.filter(
                  (obj) => obj.id && docMap[obj.id]
                );
              }

              field.value = field.value.map((obj) => {
                if (obj && obj.id && docMap[obj.id]) {
                  obj = _.merge(obj, docMap[obj.id] || {});
                  obj = _.omitBy(obj, (value, key) => key.startsWith('_'));
                }
                return obj;
              });

              field.value = Entity._mergeDocs(field.value, docMap, {
                ...options,
                _childDepth: options._childDepth + 1,
              });
            }
          }
          return field;
        });

        doc.fields = _.mapValues(doc.fields, (field, fieldSlug) => {
          if (_.isArray(field.value)) {
            if (fieldJsonQueryMap && fieldJsonQueryMap[fieldSlug]) {
              field.value = _.flatten(
                Entity._jsonQuery(doc, fieldJsonQueryMap[fieldSlug], true).value
              );
            }
          }
          return field;
        });
      }

      if (_.isArray(options.parents) && doc.parents) {
        doc.parents = _.flatten(
          Entity._jsonQuery(doc.parents, options.parents[0]).value
        );
      }

      if (isRow) {
        rowOrDoc.doc = doc;
      } else {
        rowOrDoc = doc;
      }

      return rowOrDoc;
    });

    return docs;
  }

  async _extendRowsOrDocs(rowsOrDocs, options = {}) {
    options = _.merge(
      {
        select: false,
        children: false,
        parents: false,
        role: 'guest',
      },
      options
    );

    let docMap = await this._mapDocs(rowsOrDocs, {}, options);

    rowsOrDocs = Entity._mergeDocs(rowsOrDocs, docMap, options);

    if (options.select) {
      rowsOrDocs = _.flatten(
        Entity._jsonQuery(rowsOrDocs, options.select).value
      );
    }

    docMap = null;

    return rowsOrDocs;
  }

  async _removeChildEntities(entities) {
    if (entities.length === 0) {
      return [];
    }

    entities = entities.map((entity) => entity._id);

    entities = (
      await Db.connect(this.config).view('entity', 'byChildren', {
        keys: entities,
        include_docs: true,
      })
    ).rows;

    entities = _.uniqBy(entities, ({ doc: entity }) => entity._id);

    let updatedEntities = entities.map(({ doc: entity }) => {
      entity.fields = _.mapValues(entity.fields, (field) => {
        if (!_.isArray(field.value)) {
          return field;
        }

        field.value = _.filter(
          field.value,
          (obj) => !(obj.type === 'entity' && entities.indexOf(obj.id) !== -1)
        );

        return field;
      });

      return entity;
    });

    if (updatedEntities.length === 0) {
      return [];
    }

    updatedEntities = await Helpers.chunkBulk(this.config, updatedEntities);

    return updatedEntities;
  }

  async _updateChildEntities(childEntitiesMap) {
    if (_.keys(childEntitiesMap.length) === 0) {
      return [];
    }

    const entities = (
      await Db.connect(this.config).view('entity', 'byChildren', {
        keys: _.keys(childEntitiesMap),
        include_docs: true,
      })
    ).rows;

    let updatedEntities = entities.map(({ doc: entity }) => {
      entity.fields = _.mapValues(entity.fields, (field) => {
        if (!_.isArray(field.value)) {
          return field;
        }

        field.value = field.value
          .filter((obj) => obj)
          .map((obj) => {
            if (obj.type === 'entity' && childEntitiesMap[obj.id]) {
              obj.slug = childEntitiesMap[obj.id].slug;
              obj.title = childEntitiesMap[obj.id].title;
              obj.schema = childEntitiesMap[obj.id].schema;
              obj.published = childEntitiesMap[obj.id].published;

              if (childEntitiesMap[obj.id].thumbnail) {
                obj.thumbnail = childEntitiesMap[obj.id].thumbnail;
              } else {
                obj.thumbnail = null;
              }
            }

            return obj;
          });

        return field;
      });

      return entity;
    });

    updatedEntities = await Helpers.chunkBulk(this.config, updatedEntities);

    return updatedEntities;
  }

  async entityList(ids = [], options = {}) {
    options = _.merge(
      {
        select: false,
        children: false,
        parents: false,
        role: 'guest',
      },
      options
    );

    const result = await this._entitiesById(ids, options);

    const rows = await this._extendRowsOrDocs(result.rows, options);

    return rows;
  }

  async _entitySearch(queryParams, options = {}) {
    queryParams.limit = Math.min(queryParams.limit || 200, 200);

    if (options.children) {
      queryParams.include_docs = true;
    }

    if (!queryParams.include_fields) {
      queryParams.include_fields = [];
    }

    if (!queryParams.sort) {
      delete queryParams.sort;
    }
    if (!queryParams.bookmark) {
      delete queryParams.bookmark;
    }
    if (!queryParams.index) {
      delete queryParams.index;
    }
    if (!queryParams.group_field) {
      delete queryParams.group_field;
    }

    const result = await Db.connect(this.config).search(
      'entity',
      queryParams.index || 'all',
      queryParams
    );

    if (result.groups) {
      const extendGroupHits = async (group) => {
        if ((!options.children && !options.parents) || group.total_rows === 0) {
          return [];
        }
        const docs = await this._extendRowsOrDocs(group.hits, options);
        return docs;
      };

      const promises = result.groups.map((group) => extendGroupHits(group));

      const groupHits = await Promise.all(promises);

      result.groups = result.groups.map((group, i) => {
        group.hits = groupHits[i];
        return group;
      });

      return result;
    }

    const docs = await this._extendRowsOrDocs(result.rows, options);

    result.rows = docs;

    return result;
  }

  async entitySearch(queryParams, options = {}) {
    options = _.merge(
      {
        children: false,
        parents: false,
        role: 'guest',
      },
      options
    );

    const limit = queryParams.limit || 25;

    if (limit <= 200) {
      const result = await this._entitySearch(queryParams, options);
      return result;
    }

    let rows = [];
    let groups = [];

    const _entitySearch = async (bookmark) => {
      const _queryParams = _.clone(queryParams);

      if (bookmark) {
        _queryParams.bookmark = bookmark;
      }

      const result = await this._entitySearch(_queryParams, options);

      if (result.rows) {
        rows = rows.concat(result.rows);
      }

      if (result.groups) {
        groups = groups.concat(result.groups);
      }

      if (rows.length < result.total_rows && rows.length < limit) {
        await _entitySearch(result.bookmark);
      }

      result.rows = rows;
      result.groups = groups;

      return result;
    };

    const result = await _entitySearch();
    return result;
  }

  async entityFind(mangoQuery, options = {}) {
    options = _.merge(
      {
        children: false,
        parents: false,
        role: 'guest',
      },
      options
    );

    let result;

    try {
      result = await Db.connect(this.config).find(mangoQuery);
    } catch (error) {
      if (error.error === 'no_usable_index') {
        const schema = new Schema(this.config);
        await schema.updateEntityIndex();

        result = await Db.connect(this.config).find(mangoQuery);
      }
    }

    if (options.children === false) {
      return result;
    }

    if (mangoQuery.fields && mangoQuery.fields.indexOf('_id') === -1) {
      throw Error('_id field required for `children`');
    }

    result.docs = await this._extendRowsOrDocs(result.docs, options);

    return result;
  }

  async entityRevisions(entityId) {
    const db = Db.connect(this.config);

    const revisionsInfo = (
      await db.get(entityId, {
        revs_info: true,
      })
    )._revs_info;

    const revisionIds = revisionsInfo
      .filter((revision) => revision.status === 'available')
      .map((revision) => {
        return revision.rev;
      });

    const openRevisions = await db.get(entityId, {
      open_revs: JSON.stringify(revisionIds),
    });

    const childrenIds = [];

    const revisions = openRevisions
      .filter((revision) => revision.ok)
      .map((revision) => {
        _.forEach(revision.ok.fields, (field) => {
          if (/entity/.test(field.type) && _.isArray(field.value)) {
            _.forEach(field.value, (obj) => {
              if (obj.id) {
                childrenIds.push(obj.id);
              }
            });
          }
        });

        return revision.ok;
      });

    const entities = (
      await db.fetch({
        keys: _.uniq(childrenIds),
        include_docs: true,
      })
    ).rows;

    const childrenMap = {};

    entities.forEach(({ doc: entity }) => {
      try {
        childrenMap[entity._id] = entity;
      } catch (error) {
        console.error('Error: child no longer exists');
      }
    });

    return Entity._appendChildren(revisions, childrenMap);
  }

  async entityCreate(entities) {
    if (!entities[0].schema) {
      throw Error('Entity requires `schema`');
    }

    const cc = new ClientConfig(this.config);
    const clientConfig = await cc.get();

    entities = entities.map((entity) => {
      return this._prepEntity(entity, clientConfig);
    });

    const createdEntities = await Helpers.chunkBulk(this.config, entities);

    return createdEntities;
  }

  async entityRead(entityId) {
    const entity = await Db.connect(this.config).get(entityId);
    return entity;
  }

  async entityUpdate(entities, restore = false) {
    const entityMap = Entity._mapEntities(entities);

    entities = (
      await Db.connect(this.config).fetch({
        keys: _.keys(entityMap),
        include_docs: true,
      })
    ).rows;

    const cc = new ClientConfig(this.config);
    const clientConfig = await cc.get();

    const updateChildEntitiesMap = {};
    const oldFileNames = [];

    let updatedEntities = entities.map(({ doc: oldEntity }) => {
      const newEntity = entityMap[oldEntity._id];

      let updatedEntity = _.mergeWith(
        {},
        oldEntity,
        newEntity || {},
        (a, b) => {
          if (_.isArray(a) && _.isArray(b)) {
            return b;
          }
          return undefined;
        }
      );

      if (restore) {
        updatedEntity.trashed = false;
      }

      updatedEntity = this._prepEntity(updatedEntity, clientConfig);

      if (newEntity) {
        const diffs = diff(oldEntity, newEntity);

        diffs.forEach((diff) => {
          // If any reference fields have changed, update all references
          if (
            ['published', 'slug', 'title', 'thumbnail'].includes(diff.path[0])
          ) {
            updateChildEntitiesMap[updatedEntity._id] = updatedEntity;
          }

          // If any file fields have changed, remove the old file
          if (diff.path[0] === 'fields' && diff.path[2] === 'value') {
            const field = oldEntity.fields[diff.path[1]];
            if (
              ['attachment', 'image', 'audio', 'video'].includes(field.type) &&
              field.value
            ) {
              oldFileNames.push(field.value.file.name);
            }
          }
        });
      }

      return updatedEntity;
    });

    if (oldFileNames.length) {
      // TODO: fix delete orphaned files
      // const assist = new Assist(this.config);
      // await assist.deleteFiles(oldFileNames);
    }

    updatedEntities = await Helpers.chunkBulk(this.config, updatedEntities);

    await this._updateChildEntities(updateChildEntitiesMap);

    return updatedEntities;
  }

  async entityDelete(entityIds, forever = false) {
    let entities;
    let filesResult;

    if (entityIds === 'trashed') {
      forever = true;

      entities = (
        await Db.connect(this.config).view('entity', 'trashed', {
          include_docs: true,
        })
      ).rows;
    } else {
      entities = (
        await Db.connect(this.config).fetch({
          keys: _.isArray(entityIds) ? entityIds : [entityIds],
          include_docs: true,
        })
      ).rows;
    }

    entities = entities.filter(
      (entity) => !entity.value || !entity.value.deleted
    );

    entities = entities.map((entity) => entity.doc);

    await this._removeChildEntities(entities);

    if (forever) {
      const fileNames = Entity._fileNames(entities);

      if (fileNames.length) {
        const assist = new Assist(this.config);
        filesResult = await assist.deleteFiles(fileNames);
      }

      entities = entities.map((entity) => ({
        _id: entity._id,
        _rev: entity._rev,
        _deleted: true,
      }));
    } else {
      entities = entities.map((entity) => {
        entity.trashed = true;
        return entity;
      });
    }

    const entitiesResult = await Helpers.chunkBulk(this.config, entities);

    return {
      entities: entitiesResult,
      files: filesResult,
    };
  }
}

module.exports = Entity;
