const _ = require('lodash');
const Promise = require('bluebird');
const jsonQuery = require('json-query');
const diff = require('deep-diff').diff;
const ClientConfig = require('./client-config');
const Db = require('./db');
const Helpers = require('./helpers');
const Schema = require('./schema');
const Assist = require('./assist');

const CHUNK_UPDATE_SIZE = 1000;

class Entity {
  constructor (config) {
    this.config = config;

    // Expose helpers
    this.flattenValues = Entity.flattenValues;
  }

  static flattenValues (docs) {
    return docs.map((doc) => {
      if (!doc.fields || !_.size(doc.fields)) {
        return doc;
      }

      doc.fields = _.mapValues(doc.fields, (field) => {
        if (/entity/.test(field.type) && _.isArray(field.value)) { // entity / entityTile / entityGrid
          field.value = Entity.flattenValues(field.value);
        }
        return field.value;
      });

      return doc;
    });
  }

  static filterEntityFields (docs, role = 'guest') {
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

  static _appendChildren (docs, childrenMap) {
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

  static _appendParents (result, parents = null, role = 'guest') {
    let entityMap = {};

    result.rows.forEach((row) => {
      if (!row.doc) {
        return;
      }

      if (row.value.type === 'entity') {
        if (parents) {
          row.doc.parents = [];
        }
        entityMap[row.id] = row.doc;
      }
    });

    if (parents) {
      result.rows.forEach((row) => {
        if (row.doc && row.value.type === 'parent') {
          entityMap[row.key].parents.push(Entity.filterEntityFields(row.doc, role));
        }
      });

      entityMap = _.mapValues(entityMap, (entity) => {
        entity.parents = _.uniqBy(entity.parents, entity => entity._id);
        return entity;
      });
    }

    entityMap = null;

    return result;
  }

  static _fileNames (entities) {
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

  async fieldValues (fieldSlug, searchTerm) {
    const result = await Db.connect(this.config).viewWithList('entity', 'byField', 'search', {
      startkey: [fieldSlug],
      endkey: [fieldSlug, {}],
      group: true,
      searchTerm,
    });
    return result;
  }

  static _query(doc, query, forceId = false) {
    const queryParts = query.trim().split(/\[|\]/);
    const selector = `fields.${queryParts[0]}.value[${queryParts[1] || '*'}]`;
    const modifier = /\]:/.test(query) ? `:${query.split(/\]:/).slice(-1)[0].trim()}` : '';

    const result = jsonQuery(`${selector}${modifier}`, {
      data: doc,
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
                entity.groupRatio = (entity.thumbnail || entity).ratio / group.ratio;
              });

              grouped.push(group);
            }
          });

          return grouped;
        },
        pick: (input, ...paths) => _.map(input, (obj) => {
          const copy = {};
          if (forceId && obj.id) {
            copy.id = obj.id;
          }
          paths.forEach((path) => {
            _.set(copy, path, _.get(obj, path));
          });
          return copy;
        }),
      },
      allowRegexp: true,
    });

    return result;
  }

  async _entitiesById (ids = [], parents = null, role = 'guest') {
    const query = {
      include_docs: true,
    };

    if (ids.length) {
      query.keys = ids;
    }

    let result = await Db.connect(this.config)
      .view('entity', parents ? 'byIdExtended' : 'byId', query);

    result = Entity._appendParents(result, parents, role);

    return result;
  }

  static _childDepthLimit (children, merging = false) {
    if (_.isNumber(children)) {
      return children;
    }
    if (_.isArray(children)) {
      if (merging) {
        return children.length + 1;
      }
      return children.length;
    }
    return 1;
  }

  async _getDocMap (docs, children, parents, role, docMap = {}, childDepth = 0) {
    if (!parents && !children) {
      return docMap;
    }

    let ids = [];

    docs.forEach((rowOrDoc) => {
      const isRow = !!rowOrDoc.doc;

      const doc = isRow ? rowOrDoc.doc : rowOrDoc;

      if (children && doc.fields && _.size(doc.fields)) {
        if (_.isArray(children)) {
          const queries = children[childDepth].split(/,(?![^([]*[\])])/g);

          queries.forEach((query) => {
            ids = ids.concat(_.flatten(Entity._query(doc, query, true).value).map(obj => obj && obj.id));
          });

        } else {
          _.forEach(doc.fields, (field) => {
            if (_.isArray(field.value)) {
              field.value = field.value.filter(obj => obj);

              field.value.forEach((obj) => {
                if (obj.id) {
                  ids.push(obj.id);
                }
              });
            }
          });
        }
      }

      const id = isRow ? rowOrDoc.id : doc._id || doc.id;
      if (!docMap[id]) {
        ids.push(id);
      }
    });

    ids = _.uniq(ids);

    ids = ids.filter(id => !docMap[id]);

    if (ids.length === 0) {
      return docMap;
    }

    let _docs = (await this._entitiesById(ids, parents, role)).rows.map(row => row.doc);

    _docs.forEach((doc) => {
      docMap[doc._id] = doc;
    });

    childDepth += 1;

    if (!children || (childDepth >= Entity._childDepthLimit(children))) {
      return docMap;
    }

    docMap = await this._getDocMap(_docs, children, parents, role, docMap, childDepth);

    _docs = null;

    return docMap;
  }

  static _mergeDocs(docs, docMap, children, childDepth = 0) {
    if (children && (childDepth + 1 >= Entity._childDepthLimit(children, true))) {
      return docs;
    }

    docs = docs.map((rowOrDoc) => {
      const isRow = !!rowOrDoc.doc;

      let doc = isRow ? rowOrDoc.doc : rowOrDoc;

      if (!doc.fields && docMap[rowOrDoc.id || rowOrDoc._id]) {
        doc = docMap[rowOrDoc.id || rowOrDoc._id];
      }

      if (children && doc.fields && _.size(doc.fields)) {

        let queries;

        if (_.isArray(children)) {
          queries = {};
          children[childDepth].split(/,(?![^([]*[\])])/g).forEach((query) => {
            query = query.trim();
            const queryField = query.split(/\[|\]/)[0];
            queries[queryField] = query;
          });
        }

        doc.fields = _.mapValues(doc.fields, (field, fieldSlug) => {
          if (_.isArray(field.value)) {
            field.value = field.value.filter(obj => obj);

            if (!queries || (queries && queries[fieldSlug])) {
              if (queries && queries[fieldSlug]) {
                field.value = field.value.filter(obj => obj.id && docMap[obj.id]);
              }

              field.value = field.value.map((obj) => {
                if (obj && obj.id && docMap[obj.id]) {
                  obj = _.merge(obj, docMap[obj.id] || {});
                  obj = _.omitBy(obj, (value, key) => key.startsWith('_'));
                }
                return obj;
              });

              field.value = Entity._mergeDocs(field.value, docMap, children, childDepth + 1);
            }
          }
          return field;
        });

        doc.fields = _.mapValues(doc.fields, (field, fieldSlug) => {
          if (_.isArray(field.value)) {
            if (queries && queries[fieldSlug]) {
              field.value = _.flatten(Entity._query(doc, queries[fieldSlug]).value);
            }
          }
          return field;
        });

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

  async _extendDocs (docs, children, parents, role) {
    let docMap = await this._getDocMap(docs, children, parents, role);

    docs = Entity._mergeDocs(docs, docMap, children);

    docMap = null;

    return docs;
  }

  _removeChildren (entities) {
    return new Promise((resolve, reject) => {
      if (entities.length === 0) {
        resolve([]);
        return;
      }

      entities = entities.map(entity => entity._id);

      Db.connect(this.config).view('entity', 'byChildren', {
        keys: entities,
        include_docs: true,
      })
        .then((response) => {
          const updatedEntities = _.uniqBy(response.rows, row => row.doc._id).map((row) => {
            row.doc.fields = _.mapValues(row.doc.fields, (field) => {
              if (_.isArray(field.value)) {
                field.value = _.remove(field.value, obj => obj.type === 'entity' && entities.indexOf(obj.id) !== -1);
              }
              return field;
            });

            return row.doc;
          });

          if (updatedEntities.length === 0) {
            resolve([]);
            return;
          }

          Helpers.chunkUpdate(this.config, updatedEntities, CHUNK_UPDATE_SIZE)
            .then(resolve, reject);
        }, reject);
    });
  }

  _updateChildren (entities) {
    return new Promise((resolve, reject) => {
      if (entities.length === 0) {
        resolve([]);
        return;
      }

      const entityMap = {};

      entities = entities.map((entity) => {
        entityMap[entity._id] = entity;

        return entity._id;
      });

      Db.connect(this.config).view('entity', 'byChildren', {
        keys: entities,
        include_docs: true,
      })
        .then((response) => {
          const entities = response.rows.map((row) => {
            const entity = row.doc;

            _.forEach(entity.fields, (field, fieldSlug) => {
              if (_.isArray(field.value)) {
                entity.fields[fieldSlug].value = field.value.map((obj) => {
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
              }
            });

            return entity;
          });

          Helpers.chunkUpdate(this.config, entities, CHUNK_UPDATE_SIZE)
            .then(resolve, reject);
        }, reject);
    });
  }

  async entityList (ids = [], children = null, parents = null, role = 'guest') {
    const result = await this._entitiesById(ids, parents, role);

    if ((!children && !parents) || result.total_rows === 0) {
      return result.rows;
    }

    const rows = await this._extendDocs(result.rows, children, parents, role);

    return rows;
  }

  _entitySearch (query, children = null, parents = null, role = 'guest') {
    return new Promise((resolve, reject) => {
      query.limit = Math.min(query.limit || 200, 200);
      query.sort = _.isString(query.sort) ? `"${query.sort}"` : query.sort;

      if (children) {
        query.include_docs = true;
      }

      if (!query.include_fields) {
        query.include_fields = [];
      }

      if (_.isArray(query.include_fields)) {
        query.include_fields = JSON.stringify(query.include_fields);
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

      Db.connect(this.config).search('entity', query.index || 'all', query)
        .then((result) => {

          if (result.groups) {
            const promises = [];

            result.groups = result.groups.map((group) => {
              promises.push(new Promise((resolve, reject) => {
                if ((!children && !parents) || group.total_rows === 0) {
                  resolve();
                  return;
                }

                this._extendDocs(group.hits, children, parents, role)
                  .then((docs) => {
                    group.hits = docs;

                    resolve();
                  }, reject);
              }));
              return group;
            });

            Promise.all(promises)
              .then(() => {
                resolve(result);
              }, reject);

            return;
          }

          if ((!children && !parents) || result.total_rows === 0) {
            resolve(result);
            return;
          }

          this._extendDocs(result.rows, children, parents, role)
            .then((docs) => {
              result.rows = docs;

              resolve(result);
            }, reject);
        }, reject);
    });
  }

  entitySearch (query, children = null, parents = null, role = 'guest') {
    return new Promise((resolve, reject) => {
      const limit = query.limit || 25;

      if (limit <= 200) {
        this._entitySearch(query, children, parents, role)
          .then(resolve, reject);
        return;
      }

      let rows = [];
      let groups = [];

      function __entitySearch (bookmark) {
        const _query = _.clone(query);

        if (bookmark) {
          _query.bookmark = bookmark;
        }

        this._entitySearch(_query, children, parents, role)
          .then((result) => {
            if (result.rows) {
              rows = rows.concat(result.rows);
            }
            if (result.groups) {
              groups = groups.concat(result.groups);
            }

            if (rows.length < result.total_rows && rows.length < limit) {
              __entitySearch.call(this, result.bookmark);
              return;
            }

            result.rows = rows;
            result.groups = groups;

            resolve(result);
          }, reject);
      }

      __entitySearch.call(this);
    });
  }

  async entityFind (query, children = null, parents = null, role = 'guest') {
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

    if (children === false) {
      return result;
    }

    if (query.fields && query.fields.indexOf('_id') === -1) {
      throw new Error('_id field required for `children`');
    }

    result.docs = await this._extendDocs(result.docs, children, parents, role);

    return result;
  }

  entityRevisions (entityId) {
    return new Promise((resolve, reject) => {
      Db.connect(this.config).get(entityId, {
        revs_info: true,
      })
        .then((response) => {
          const revisionIds = [];

          response._revs_info.forEach((revision) => {
            if (revision.status === 'available') {
              revisionIds.push(revision.rev);
            }
          });

          Db.connect(this.config).get(entityId, {
            open_revs: JSON.stringify(revisionIds),
          })
            .then((response) => {
              const revisions = [];
              const childrenIds = [];

              response.forEach((revision) => {
                if (revision.ok) {
                  revisions.push(revision.ok);

                  _.forEach(revision.ok.fields, (field) => {
                    if (/entity/.test(field.type)) {
                      _.forEach(field.value, (obj) => {
                        if (obj.id) {
                          childrenIds.push(obj.id);
                        }
                      });
                    }
                  });
                }
              });

              Db.connect(this.config).fetch({
                keys: _.uniq(childrenIds),
                include_docs: true,
              })
                .then((result) => {
                  const childrenMap = {};

                  result.rows.forEach((row) => {
                    try {
                      childrenMap[row.doc._id] = row.doc;
                    } catch (error) {
                      console.error('Error: child no longer exists');
                    }
                  });

                  resolve(Entity._appendChildren(revisions, childrenMap));
                }, reject);
            }, reject);
        }, reject);
    });
  }

  entityCreate (entity) {
    return new Promise((resolve, reject) => {
      entity.type = 'entity';

      Db.connect(this.config).insert(entity)
        .then((response) => {
          entity._id = response.id;
          entity._rev = response.rev;

          resolve(entity);
        }, reject);
    });
  }

  entityRead (entityId) {
    return new Promise((resolve, reject) => {
      Db.connect(this.config).get(entityId)
        .then(resolve, reject);
    });
  }

  entityUpdate (entities, restore) {
    return new Promise((resolve, reject) => {
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

      Db.connect(this.config).fetch({
        keys: entityIds,
        include_docs: true,
      })
        .then((response) => {
          const children = [];

          const entities = response.rows.map((row) => {
            const oldEntity = row.doc;
            const newEntity = entityMap[oldEntity._id];

            let entity = oldEntity;

            if (newEntity) {
              delete newEntity._rev;

              const diffs = diff(oldEntity, newEntity);

              diffs.forEach((diff) => {
                if (/slug|title|thumbnail/.test(diff.path[0])) {
                  if (children.indexOf(newEntity) === -1 && entityIds.indexOf(newEntity._id) !== -1) {
                    children.push(newEntity);
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

          this._updateChildren(children)
            .then(() => {
              Helpers.chunkUpdate(this.config, entities, CHUNK_UPDATE_SIZE)
                .then(resolve, reject);
            }, reject);
        }, reject);
    });
  }

  async entityDelete (entityIds, forever = false) {
    let entities;
    let filesResult;

    if (entityIds === 'trashed') {
      forever = true;

      entities = (await Db.connect(this.config).view('entity', 'trashed', {
        include_docs: true,
      })).rows;

    } else {
      entities = (await Db.connect(this.config).fetch({
        keys: _.isArray(entityIds) ? entityIds : [entityIds],
        include_docs: true,
      })).rows;
    }

    entities = entities.filter(entity => !entity.value || !entity.value.deleted);

    entities = entities.map(entity => entity.doc);

    if (forever) {
      await this._removeChildren(entities);

      const fileNames = Entity._fileNames(entities);

      if (fileNames.length) {
        const assist = new Assist(this.config);
        filesResult = await assist.deleteFiles(fileNames);
      }

      entities = entities.map(entity => ({
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

    const entitiesResult = await Helpers.chunkUpdate(this.config, entities, CHUNK_UPDATE_SIZE);

    return {
      entities: entitiesResult,
      files: filesResult,
    };
  }

}

module.exports = Entity;
