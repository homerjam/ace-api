const _ = require('lodash');
const jsonQuery = require('json-query');
const { diff } = require('deep-diff');
const ClientConfig = require('./client-config');
const Db = require('./db');
const Helpers = require('./helpers');
const Schema = require('./schema');
const Assist = require('./assist');

class Entity {
  constructor(config) {
    this.config = config;

    // Expose helpers
    this.flattenValues = Entity.flattenValues;
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

  static _appendParents(rows, parents = null, role = 'guest') {
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

  static _query(data, query, isFieldQuery = false) {
    query = query.replace(/(\s\s|\t|\r|\n)/g, '');

    if (isFieldQuery) {
      const queryParts = query.trim().split(/\[|\]/);
      const selector = `fields.${queryParts[0]}.value[${queryParts[1] || '*'}]`;
      const modifier = /\]:/.test(query)
        ? `:${query.split(/\]:/).slice(-1)[0].trim()}`
        : '';
      query = `${selector}${modifier}`;
    }

    const result = jsonQuery(query, {
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

  static _queriesFromString(queryString) {
    // Remove white space
    queryString = queryString.replace(/(\s\s|\t|\r|\n)/gm, '');

    // Match and store (...args) from query so we can split by comma
    const methodArgs = queryString.match(/\(([^)]+)\)/g);

    // Replace (...args) with empty ()
    queryString = queryString.replace(/\(.*?\)/g, '()');

    // Extract queries
    let queries = queryString.split(/,(?![^([]*[\])])/g);

    queries = queries.map((query) => {
      // Replace () with original (...args)
      const emptyArgs = query.match(/\(\)/g);
      if (emptyArgs) {
        _.times(emptyArgs.length, () => {
          query = query.replace('()', methodArgs.splice(0, 1));
        });
      }
      return query.trim();
    });

    return queries;
  }

  async _entitiesById(ids = [], options = {}) {
    options = _.merge(
      {
        parents: false,
        role: 'guest',
      },
      options
    );

    const query = {
      include_docs: true,
    };

    if (ids.length) {
      query.keys = ids;
    }

    const result = await Db.connect(this.config).view(
      'entity',
      options.parents ? 'byIdExtended' : 'byId',
      query
    );

    result.rows = result.rows.map((row) => {
      row.doc = Entity._filterEntityFields(row.doc, options.role);
      return row;
    });

    result.rows = Entity._appendParents(
      result.rows,
      options.parents,
      options.role
    );

    return result;
  }

  static _childDepthLimit(children) {
    let limit = 0;
    if (_.isNumber(children)) {
      limit = children - 1;
    }
    if (_.isArray(children)) {
      limit = children.length - 1;
    }
    return limit;
  }

  async _getDocMap(rowsOrDocs, docMap = {}, options = {}) {
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
          Entity._queriesFromString(
            options.children[options._childDepth]
          ).forEach((query) => {
            childIds = childIds.concat(
              _.flatten(Entity._query(doc, query, true).value).map(
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
      options._childDepth === Entity._childDepthLimit(options.children)
    ) {
      return docMap;
    }

    return await this._getDocMap(childDocs, docMap, {
      ...options,
      parents: false,
      _childDepth: options._childDepth + 1,
    });
  }

  static _mergeDocs(
    docs,
    docMap,
    options = { children: false, parents: false }
  ) {
    options._childDepth = options._childDepth || 0;

    if (
      options.children &&
      options._childDepth - 1 === Entity._childDepthLimit(options.children)
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
        let fieldQueryMap;

        if (_.isArray(options.children)) {
          fieldQueryMap = {};
          Entity._queriesFromString(
            options.children[options._childDepth]
          ).forEach((query) => {
            const key = query.split(/\[|\]/)[0];
            fieldQueryMap[key] = query;
          });
        }

        doc.fields = _.mapValues(doc.fields, (field, fieldSlug) => {
          if (_.isArray(field.value)) {
            field.value = field.value.filter((obj) => obj);

            if (!fieldQueryMap || (fieldQueryMap && fieldQueryMap[fieldSlug])) {
              if (fieldQueryMap && fieldQueryMap[fieldSlug]) {
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
            if (fieldQueryMap && fieldQueryMap[fieldSlug]) {
              field.value = _.flatten(
                Entity._query(doc, fieldQueryMap[fieldSlug], true).value
              );
            }
          }
          return field;
        });
      }

      if (_.isArray(options.parents) && doc.parents) {
        doc.parents = _.flatten(
          Entity._query(doc.parents, options.parents[0]).value
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

    let docMap = await this._getDocMap(rowsOrDocs, {}, options);

    rowsOrDocs = Entity._mergeDocs(rowsOrDocs, docMap, options);

    if (options.select) {
      rowsOrDocs = _.flatten(Entity._query(rowsOrDocs, options.select).value);
    }

    docMap = null;

    return rowsOrDocs;
  }

  async _removeChildren(entities) {
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

    const updatedEntities = entities.map(({ doc: entity }) => {
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

    return await Helpers.chunkUpdate(this.config, updatedEntities);
  }

  async _updateChildren(entities) {
    if (entities.length === 0) {
      return [];
    }

    const entityMap = {};

    entities = entities.map((entity) => {
      entityMap[entity._id] = entity;
      return entity._id;
    });

    entities = (
      await Db.connect(this.config).view('entity', 'byChildren', {
        keys: entities,
        include_docs: true,
      })
    ).rows;

    const updatedEntities = entities.map(({ doc: entity }) => {
      entity.fields = _.mapValues(entity.fields, (field) => {
        if (!_.isArray(field.value)) {
          return field;
        }

        field.value = field.value
          .filter((obj) => obj)
          .map((obj) => {
            if (obj.type === 'entity' && entityMap[obj.id]) {
              obj.slug = entityMap[obj.id].slug;
              obj.title = entityMap[obj.id].title;
              obj.schema = entityMap[obj.id].schema;
              obj.published = entityMap[obj.id].published;

              if (entityMap[obj.id].thumbnail) {
                obj.thumbnail = entityMap[obj.id].thumbnail;
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

    return await Helpers.chunkUpdate(this.config, updatedEntities);
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

  async _entitySearch(query, options = {}) {
    query.limit = Math.min(query.limit || 200, 200);

    if (options.children) {
      query.include_docs = true;
    }

    if (!query.include_fields) {
      query.include_fields = [];
    }

    if (!query.sort) {
      delete query.sort;
    }
    if (!query.bookmark) {
      delete query.bookmark;
    }
    if (!query.index) {
      delete query.index;
    }
    if (!query.group_field) {
      delete query.group_field;
    }

    const result = await Db.connect(this.config).search(
      'entity',
      query.index || 'all',
      query
    );

    if (result.groups) {
      const extendGroupHits = async (group) => {
        if ((!options.children && !options.parents) || group.total_rows === 0) {
          return [];
        }
        return await this._extendRowsOrDocs(group.hits, options);
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

  async entitySearch(query, options = {}) {
    options = _.merge(
      {
        children: false,
        parents: false,
        role: 'guest',
      },
      options
    );

    const limit = query.limit || 25;

    if (limit <= 200) {
      return await this._entitySearch(query, options);
    }

    let rows = [];
    let groups = [];

    const _entitySearch = async (bookmark) => {
      const _query = _.clone(query);

      if (bookmark) {
        _query.bookmark = bookmark;
      }

      const result = await this._entitySearch(_query, options);

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

    return await _entitySearch();
  }

  async entityFind(query, options = {}) {
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
      result = await Db.connect(this.config).find(query);
    } catch (error) {
      if (error.error === 'no_usable_index') {
        const cc = new ClientConfig(this.config);
        const clientConfig = await cc.get();

        const schema = new Schema(this.config);
        await schema.updateEntityIndex(clientConfig.schemas);

        result = await Db.connect(this.config).find(query);
      }
    }

    if (options.children === false) {
      return result;
    }

    if (query.fields && query.fields.indexOf('_id') === -1) {
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

  async entityCreate(entity) {
    entity.type = 'entity';

    const { id, rev } = await Db.connect(this.config).insert(entity);

    entity._id = id;
    entity._rev = rev;

    return entity;
  }

  async entityRead(entityId) {
    return await Db.connect(this.config).get(entityId);
  }

  async entityUpdate(entities, restore) {
    entities = _.isArray(entities) ? entities : [entities];

    const entityMap = {};

    const entityIds = entities.map((entityOrEntityId) => {
      let entityId;

      if (_.isObject(entityOrEntityId)) {
        entityId = entityOrEntityId._id;
        entityMap[entityId] = entityOrEntityId;
      }
      if (_.isString(entityOrEntityId)) {
        entityId = entityOrEntityId;
      }

      return entityId;
    });

    const response = await Db.connect(this.config).fetch({
      keys: entityIds,
      include_docs: true,
    });

    const children = [];
    const oldFileNames = [];

    entities = response.rows.map((row) => {
      const oldEntity = row.doc;
      const newEntity = entityMap[oldEntity._id];

      let entity = oldEntity;

      if (newEntity) {
        delete newEntity._rev;

        const diffs = diff(oldEntity, newEntity);

        diffs.forEach((diff) => {
          // If any reference fields have changed, update all references
          if (/published|slug|title|thumbnail/.test(diff.path[0])) {
            if (
              children.indexOf(newEntity) === -1 &&
              entityIds.indexOf(newEntity._id) !== -1
            ) {
              children.push(newEntity);
            }
          }

          // If any file fields have changed, remove the old file
          if (diff.path[0] === 'fields' && diff.path[2] === 'value') {
            const field = oldEntity.fields[diff.path[1]];
            if (
              /attachment|image|audio|video/.test(field.type) &&
              field.value
            ) {
              oldFileNames.push(field.value.file.name);
            }
          }
        });

        entity = _.mergeWith({}, oldEntity, newEntity, (a, b) => {
          if (_.isArray(a) && _.isArray(b)) {
            return b;
          }
          return undefined;
        });
      }

      if (restore) {
        entity.trashed = false;
      }

      return entity;
    });

    if (oldFileNames.length) {
      // TODO: fix delete orphaned files
      // const assist = new Assist(this.config);
      // await assist.deleteFiles(oldFileNames);
    }

    if (children.length) {
      await this._updateChildren(children);
    }

    const result = await Helpers.chunkUpdate(this.config, entities);

    return result;
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

    await this._removeChildren(entities);

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

    const entitiesResult = await Helpers.chunkUpdate(this.config, entities);

    return {
      entities: entitiesResult,
      files: filesResult,
    };
  }
}

module.exports = Entity;
