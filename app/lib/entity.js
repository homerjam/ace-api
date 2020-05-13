const _ = require('lodash');
const jsonQuery = require('json-query');
const odiff = require('odiff');
const he = require('he');
const Handlebars = require('handlebars');
const ClientConfig = require('./client-config');
const Db = require('./db');
const Fields = require('./fields');
const Utils = require('./utils');
const Schema = require('./schema');
const Assist = require('./assist');

class Entity {
  constructor(appConfig) {
    this.appConfig = appConfig;

    return this;
  }

  static flattenValues(docs) {
    return docs.map((doc) => {
      doc.fields = _.mapValues(doc.fields || {}, (field) => {
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
          throw Error(`Entity requires '_id'`);
        }
        result[id] = value;
        return result;
      },
      {}
    );
  }

  static _filterEntityFields(entity, role = 'guest') {
    entity.fields = _.mapValues(entity.fields || {}, (field) => {
      if (_.isArray(field.value)) {
        field.value = field.value.filter((ref) => {
          if (!ref) {
            return false;
          }
          if (ref.type === 'entity' && role === 'guest') {
            return ref.published;
          }
          return true;
        });
      }
      return field;
    });
    return entity;
  }

  static _appendChildEntities(entities, childEntityMap) {
    return entities.map((entity) => {
      entity.fields = _.mapValues(entity.fields || {}, (field) => {
        if (_.isArray(field.value)) {
          field.value = field.value.filter((ref) => {
            if (!ref) {
              return false;
            }
            if (ref.type === 'entity') {
              return childEntityMap[ref.id] !== undefined;
            }
            return true;
          });

          field.value = field.value.map((ref) => {
            if (ref.type === 'entity') {
              ref = _.merge(ref, childEntityMap[ref.id]);
            }
            // ref = _.omitBy(ref, (value, key) => key.startsWith('_'));
            return ref;
          });
        }

        return field;
      });

      return entity;
    });
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
      'publishedAt',
      'published',
      'thumbnail',
      'trashed',
    ]);

    const schema = _.find(clientConfig.schemas, { slug: entity.schema });

    if (!schema) {
      throw Error('Schema not found');
    }

    entity.type = 'entity';

    entity.schema = schema.slug;

    const now = Utils.now();

    if (!entity.createdAt) {
      entity.createdAt = now;
    }
    if (!entity.createdBy) {
      entity.createdBy = this.appConfig.userId;
    }

    entity.modifiedAt = now;
    entity.modifiedBy = this.appConfig.userId;

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
    const result = await Db.connect(this.appConfig).viewWithList(
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

  async _entityMapById(ids = [], { parents = false, role = 'guest' }) {
    const { rows } = await Db.connect(this.appConfig).view(
      'entity',
      parents ? 'byIdExtended' : 'byId',
      {
        include_docs: true,
        keys: ids.length ? ids : undefined,
      }
    );

    const entities = _.reduce(
      rows,
      (result, row) => {
        if (row.value.type === 'entity') {
          result[row.id] = _.merge(
            result[row.id] || {},
            Entity._filterEntityFields(row.doc, role)
          );
        }
        if (row.value.type === 'parent') {
          result[row.key] = _.merge(result[row.key] || {}, {
            parents: {
              [row.id]: Entity._filterEntityFields(row.doc, role),
            },
          });
        }
        return result;
      },
      {}
    );

    return entities;
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

  async _extendEntityMap(
    entityMap,
    { children, parents, role, childDepth = 0 }
  ) {
    if (!parents && !children) {
      return entityMap;
    }

    let ids = [];
    let childIds = [];

    _.forEach(entityMap, (entity, entityId) => {
      entity = Entity._filterEntityFields(entity, role); // TODO: necessary?

      if (children) {
        if (_.isArray(children)) {
          Entity._splitJsonQueries(children[childDepth]).forEach(
            (queryString) => {
              _.flatten(Entity._jsonQuery(entity, queryString, true).value)
                .filter((ref) => ref && ref.id)
                .forEach((ref) => childIds.push(ref.id));
            }
          );
        } else {
          _.forEach(entity.fields || {}, (field) => {
            if (_.isArray(field.value)) {
              field.value
                .filter((ref) => ref && ref.id)
                .forEach((ref) => childIds.push(ref.id));
            }
          });
        }
      }

      ids.push(entityId);
    });

    ids = _.uniq(ids).filter((id) => !entityMap[id]);

    if (ids.length > 0) {
      entityMap = {
        ...entityMap,
        ...(await this._entityMapById(ids, { parents, role })),
      };
    }

    childIds = _.uniq(childIds).filter((id) => !entityMap[id]);

    if (childIds.length > 0) {
      entityMap = {
        ...entityMap,
        ...(await this._entityMapById(childIds, { parents: false, role })),
      };
    }

    if (!children || childDepth === Entity._childEntitiesDepthLimit(children)) {
      return entityMap;
    }

    entityMap = await this._extendEntityMap(entityMap, {
      children,
      parents: false,
      role,
      childDepth: childDepth + 1,
    });

    return entityMap;
  }

  static _mergeEntityMap(
    entities,
    entityMap,
    { children, parents, childDepth = 0 }
  ) {
    if (
      children &&
      childDepth - 1 === Entity._childEntitiesDepthLimit(children)
    ) {
      return entities;
    }

    entities = entities.map((entity) => {
      entity = _.merge({}, entity, entityMap[entity._id || entity.id] || {});

      if (children) {
        let fieldJsonQueryMap;

        if (_.isArray(children)) {
          fieldJsonQueryMap = {};
          Entity._splitJsonQueries(children[childDepth]).forEach(
            (queryString) => {
              const key = queryString.split(/\[|\]/)[0];
              fieldJsonQueryMap[key] = queryString;
            }
          );
        }

        entity.fields = _.mapValues(entity.fields || {}, (field, fieldSlug) => {
          if (_.isArray(field.value)) {
            field.value = field.value.filter((obj) => obj);

            if (
              !fieldJsonQueryMap ||
              (fieldJsonQueryMap && fieldJsonQueryMap[fieldSlug])
            ) {
              if (fieldJsonQueryMap && fieldJsonQueryMap[fieldSlug]) {
                field.value = field.value.filter(
                  (ref) => ref.id && entityMap[ref.id]
                );
              }

              field.value = field.value.map((ref) => {
                if (ref.id && entityMap[ref.id]) {
                  ref = _.merge(ref, entityMap[ref.id]);
                  // ref = _.omitBy(ref, (value, key) => key.startsWith('_'));
                }
                return ref;
              });

              field.value = Entity._mergeEntityMap(field.value, entityMap, {
                children,
                parents,
                childDepth: childDepth + 1,
              });
            }
          }
          return field;
        });

        entity.fields = _.mapValues(entity.fields, (field, fieldSlug) => {
          if (_.isArray(field.value)) {
            if (fieldJsonQueryMap && fieldJsonQueryMap[fieldSlug]) {
              field.value = _.flatten(
                Entity._jsonQuery(entity, fieldJsonQueryMap[fieldSlug], true)
                  .value
              );
            }
          }
          return field;
        });
      }

      if (_.isArray(parents) && entity.parents) {
        entity.parents = _.flatten(
          Entity._jsonQuery(entity.parents, parents[0]).value
        );
      }

      return entity;
    });

    return entities;
  }

  async _extendEntities(
    entities,
    { select = false, children = false, parents = false, role = 'guest' }
  ) {
    let entityMap = Entity._mapEntities(entities);

    entityMap = await this._extendEntityMap(entityMap, {
      children,
      parents,
      role,
    });

    entities = Entity._mergeEntityMap(entities, entityMap, {
      children,
      parents,
    });

    if (select) {
      entities = _.flatten(Entity._jsonQuery(entities, select).value);
    }

    return entities;
  }

  async _removeFromChildEntities(entities) {
    if (entities.length === 0) {
      return [];
    }

    entities = entities.map((entity) => entity._id);

    entities = (
      await Db.connect(this.appConfig).view('entity', 'byChildren', {
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
          (ref) => !(ref.type === 'entity' && entities.includes(ref.id))
        );

        return field;
      });

      return entity;
    });

    if (updatedEntities.length === 0) {
      return [];
    }

    updatedEntities = await Utils.chunkBulk(this.appConfig, updatedEntities);

    return updatedEntities;
  }

  async _updateChildEntities(childEntitiesMap = {}) {
    if (_.keys(childEntitiesMap.length) === 0) {
      return [];
    }

    const { rows: entities } = await Db.connect(this.appConfig).view(
      'entity',
      'byChildren',
      {
        keys: _.keys(childEntitiesMap),
        include_docs: true,
      }
    );

    let updatedEntities = entities.map(({ doc: entity }) => {
      entity.fields = _.mapValues(entity.fields, (field) => {
        if (!_.isArray(field.value)) {
          return field;
        }

        field.value = field.value
          .filter((ref) => ref)
          .map((ref) => {
            if (ref.type === 'entity' && childEntitiesMap[ref.id]) {
              ref = {
                ...ref,
                ..._.pick(childEntitiesMap[ref.id], [
                  'slug',
                  'title',
                  'schema',
                  'published',
                  'thubmnail',
                ]),
              };
            }
            return ref;
          });

        return field;
      });

      return entity;
    });

    updatedEntities = await Utils.chunkBulk(this.appConfig, updatedEntities);

    return updatedEntities;
  }

  async entityList(
    ids,
    { select = false, children = false, parents = false, role = 'guest' }
  ) {
    const entityMap = await this._entityMapById(ids, {
      parents,
      role,
    });

    const entities = await this._extendEntities(_.values(entityMap), {
      select,
      children,
      parents,
      role,
    });

    return entities;
  }

  async _entitySearch(
    queryParams,
    { select = false, children = false, parents = false, role = 'guest' }
  ) {
    queryParams.limit = Math.min(queryParams.limit || 200, 200);

    if (children) {
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

    const result = await Db.connect(this.appConfig).search(
      'entity',
      queryParams.index || 'all',
      queryParams
    );

    if (result.groups) {
      const extendGroup = async (group) => {
        if ((!children && !parents) || group.total_rows === 0) {
          return group;
        }

        let entities = group.rows.map((row) => row.doc);

        entities = await this._extendEntities(entities, {
          select,
          children,
          parents,
          role,
        });

        const entityMap = Entity._mapEntities(entities);

        group.rows = group.rows.map((row) => {
          row.doc = entityMap[row.id];
          return row;
        });

        return group;
      };

      const promises = result.groups.map((group) => extendGroup(group));

      const extendGroupResults = await Promise.all(promises);

      result.groups = result.groups.map((group, i) => {
        return extendGroupResults[i];
      });

      return result;
    }

    let entities = result.rows.map((row) => row.doc);

    entities = await this._extendEntities(entities, {
      select,
      children,
      parents,
      role,
    });

    const entityMap = Entity._mapEntities(entities);

    result.rows = result.rows.map((row) => {
      row.doc = entityMap[row.id];
      return row;
    });

    return result;
  }

  async entitySearch(
    queryParams,
    { select = false, children = false, parents = false, role = 'guest' }
  ) {
    const limit = queryParams.limit || 25;

    if (limit <= 200) {
      const result = await this._entitySearch(queryParams, {
        select,
        children,
        parents,
        role,
      });
      return result;
    }

    let rows = [];
    let groups = [];

    const _entitySearch = async (bookmark) => {
      const _queryParams = _.clone(queryParams);

      if (bookmark) {
        _queryParams.bookmark = bookmark;
      }

      const result = await this._entitySearch(_queryParams, {
        select,
        children,
        parents,
        role,
      });

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

  async entityFind(
    mangoQuery,
    { select = false, children = false, parents = false, role = 'guest' }
  ) {
    let result;

    try {
      result = await Db.connect(this.appConfig).find(mangoQuery);
    } catch (error) {
      if (error.error === 'no_usable_index') {
        await new Schema(this.appConfig).updateEntityIndex();

        result = await Db.connect(this.appConfig).find(mangoQuery);
      }
    }

    if (!children) {
      return result;
    }

    if (mangoQuery.fields && mangoQuery.fields.indexOf('_id') === -1) {
      throw Error('_id field required for `children`');
    }

    const entities = await this._extendEntities(result.docs, {
      select,
      children,
      parents,
      role,
    });

    result.docs = entities;

    return result;
  }

  async entityRevisions(entityId) {
    const db = Db.connect(this.appConfig);

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
            _.forEach(field.value, (ref) => {
              if (ref.id) {
                childrenIds.push(ref.id);
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

    const childEntityMap = {};

    entities.forEach(({ doc: entity }) => {
      try {
        childEntityMap[entity._id] = entity;
      } catch (error) {
        console.error('Error: child no longer exists');
      }
    });

    return Entity._appendChildEntities(revisions, childEntityMap);
  }

  async entityCreate(entities) {
    if (!entities[0].schema) {
      throw Error(`Entity requires 'schema'`);
    }

    const clientConfig = await new ClientConfig(this.appConfig).read();

    entities = entities.map((entity) => {
      return this._prepEntity(entity, clientConfig);
    });

    const createdEntities = await Utils.chunkBulk(this.appConfig, entities);

    return createdEntities;
  }

  async entityRead(entityId) {
    const entity = await Db.connect(this.appConfig).get(entityId);
    return entity;
  }

  async entityUpdate(entities, restore = false) {
    const entityMap = Entity._mapEntities(entities);

    entities = (
      await Db.connect(this.appConfig).fetch({
        keys: _.keys(entityMap),
        include_docs: true,
      })
    ).rows;

    const clientConfig = await new ClientConfig(this.appConfig).read();

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
        const changes = odiff(oldEntity, newEntity);

        changes
          .filter((change) => change.type === 'set')
          .forEach((change) => {
            // If any reference fields have changed, update all references
            if (
              ['published', 'slug', 'title', 'thumbnail'].includes(
                change.path[0]
              )
            ) {
              updateChildEntitiesMap[updatedEntity._id] = updatedEntity;
            }

            // If any file fields have changed, remove the old file
            if (change.path.slice(2).join('.') === 'value.file.name') {
              oldFileNames.push(change.val);
            }
          });
      }

      return updatedEntity;
    });

    if (oldFileNames.length) {
      // TODO: fix delete orphaned files
      // const assist = new Assist(this.appConfig);
      // await assist.deleteFiles(oldFileNames);
    }

    updatedEntities = await Utils.chunkBulk(this.appConfig, updatedEntities);

    await this._updateChildEntities(updateChildEntitiesMap);

    return updatedEntities;
  }

  async _entityDelete(entityIds, forever = false) {
    let files;

    let entities = await Db.connect(this.appConfig).fetch({
      keys: _.isArray(entityIds) ? entityIds : [entityIds],
      include_docs: true,
    });

    entities = entities.rows
      .filter((entity) => !_.get(entity, 'value.deleted'))
      .map((entity) => entity.doc);

    await this._removeFromChildEntities(entities);

    if (forever) {
      const fileNames = Entity._fileNames(entities);

      if (fileNames.length) {
        const assist = new Assist(this.appConfig);
        files = await assist.deleteFiles(fileNames);
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

    entities = await Utils.chunkBulk(this.appConfig, entities);

    return {
      entities,
      files,
    };
  }

  async entityDelete(entities, forever = false) {
    if (entities === 'trashed') {
      const entityIds = (
        await Db.connect(this.appConfig).view('entity', 'trashed', {})
      ).rows.map((row) => row.id);

      const result = await this._entityDelete(entityIds, true);
      return result.entities;
    }

    const entityIds = entities.map((entity) => entity._id);

    const result = await this._entityDelete(entityIds, forever);
    return result.entities;
  }
}

module.exports = Entity;
