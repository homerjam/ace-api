const _ = require('lodash');
const Promise = require('bluebird');
const diff = require('deep-diff').diff;
const ClientConfig = require('./client-config');
const Db = require('./db');
const Helpers = require('./helpers');
const Schema = require('./schema');

const CHUNK_UPDATE_SIZE = 1000;

class Entity {
  constructor (config) {
    this.config = config;
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

  static filterEntityFieldsByRole (docs, role = 'guest') {
    return docs.map((doc) => {
      if (_.size(doc.fields)) {
        doc.fields = _.mapValues(doc.fields, (field) => {
          if (_.isArray(field.value)) {
            field.value = field.value.filter((obj) => {
              if (obj.type === 'entity' && role === 'guest') {
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
  }

  static _consolidateChildren (docs, childrenMap) {
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
              obj = _.merge({}, obj, childrenMap[obj.id]);
            }
            obj = _.omitBy(obj, (value, key) => key.startsWith('_'));
            return obj;
          });
        }

        if (_.isObject(field.value)) {
          if (field.value.type === 'file' && childrenMap[field.value.id]) {
            field.value = _.merge({}, field.value, childrenMap[field.value.id]);
            field.value = _.omitBy(field.value, (value, key) => key.startsWith('_'));
          }
        }

        return field;
      });

      return doc;
    });
  }

  static consolidateResult (result, children = null, parents = null, role = 'guest') {
    let docs = [];
    let entityMap = {};
    let childrenMap = {};

    result.rows.forEach((row) => {
      if (!row.doc) {
        return;
      }

      if (children && row.value.type === 'field') {
        childrenMap[row.doc._id] = Entity.filterEntityFieldsByRole([row.doc], role)[0];
      }

      if (parents && row.value.type === 'entity') {
        row.doc.parents = [];
        entityMap[row.key] = row.doc;
      }

      if (row.value.type === 'entity') {
        docs.push(row.doc);
      }
    });

    if (children) {
      docs = Entity._consolidateChildren(docs, childrenMap);
    }

    if (parents) {
      result.rows.forEach((row) => {
        // if (!entityMap[row.key].parents) {
        //   entityMap[row.key].parents = [];
        // }
        // if (!entityMap[row.key]._parentsMap) {
        //   entityMap[row.key]._parentsMap = {};
        // }

        if (row.doc && row.value.type === 'parent') {
          // const parent = Entity.filterEntityFieldsByRole([row.doc], role)[0];

          // if (!entityMap[row.key]._parentsMap[parent._id]) {
          //   entityMap[row.key]._parentsMap[parent._id] = true;

          entityMap[row.key].parents.push(Entity.filterEntityFieldsByRole([row.doc], role)[0]);
          // }
        }
      });

      entityMap = _.mapValues(entityMap, (entity) => {
        entity.parents = _.uniqBy(entity.parents, entity => entity._id);
        return entity;
      });
    }

    // result.rows.forEach((row) => {
    //   if (entityMap[row.key]._parentsMap) {
    //     delete entityMap[row.key]._parentsMap;
    //   }
    // });

    entityMap = null;
    childrenMap = null;

    return docs;
  }

  static _fileIds (entities) {
    const fileIds = [];

    entities.forEach((entity) => {
      _.forEach(entity.fields, (field) => {
        if (field.value) {
          if (field.value.type === 'file') {
            fileIds.push(field.value.id);
          }
        }
      });
    });

    return _.uniq(fileIds);
  }

  async fieldValues (fieldSlug, searchTerm) {
    const result = await Db.connect(this.config).viewWithListAsync('entity', 'byField', 'search', {
      startkey: [fieldSlug],
      endkey: [fieldSlug, {}],
      group: true,
      searchTerm,
    });
    return result;
  }

  entitiesById (ids, children = null, parents = null, role = 'guest') {
    return new Promise((resolve, reject) => {
      if (ids.length === 0) {
        resolve([]);
        return;
      }
      Db.connect(this.config).viewAsync('entity', parents ? 'byIdExtended' : 'byId', {
        keys: ids,
        include_docs: true,
      })
        .then((result) => {
          const docs = Entity.consolidateResult(result, children, parents, role);
          resolve(docs);
        }, reject);
    });
  }

  async _getDocMap (docs, children, parents, role, childDepth = 1) {
    const docMap = {};

    const _getDocs = async (_docs) => {
      const ids = [];

      _docs.forEach((rowOrDoc) => {
        const isRow = !!rowOrDoc.doc;

        const doc = isRow ? rowOrDoc.doc : rowOrDoc;

        if (children && doc.fields) {
          _.forEach(doc.fields, (field) => {
            if (field && field.value && /entity/.test(field.type)) { // entity / entityTile / entityGrid
              field.value.forEach((entity) => {
                if (!docMap[entity.id]) {
                  ids.push(entity.id);
                }
              });
            }
          });

        } else {
          ids.push(doc.id || doc._id);
        }
      });

      const __docs = await this.entitiesById(ids, children, parents, role);

      __docs.forEach((doc) => {
        docMap[doc._id] = doc;
      });

      if (!children || childDepth === children) {
        return;
      }

      childDepth += 1;

      await _getDocs(__docs);
    };

    await _getDocs(docs);

    return docMap;
  }

  static _mergeDocs(docs, docMap, children, childDepth = 1) {
    if (!children || childDepth === children) {
      return docs;
    }

    childDepth += 1;

    docs = docs.map((rowOrDoc) => {
      const isRow = !!rowOrDoc.doc;

      const doc = docMap[rowOrDoc.id || rowOrDoc._id] || (isRow ? rowOrDoc.doc : rowOrDoc);

      if (doc.fields) {
        doc.fields = _.mapValues(doc.fields, (field) => {
          if (field && field.value && /entity/.test(field.type)) { // entity / entityTile / entityGrid
            field.value = field.value.map(entity => _.merge(entity, docMap[entity.id] || {}));

            field.value = Entity._mergeDocs(field.value, docMap, children, childDepth);
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

  async _extendDocs (docs, children, parents, role, childDepth = 1) {
    const docMap = await this._getDocMap(docs, children, parents, role, childDepth);

    docs = Entity._mergeDocs(docs, docMap, children, childDepth);

    return docs;
  }

  _detachFiles (entities) {
    return new Promise((resolve, reject) => {
      const fileIds = Entity._fileIds(entities);

      if (fileIds.length === 0) {
        resolve([]);
        return;
      }

      Db.connect(this.config).fetchAsync({
        keys: fileIds,
        include_docs: true,
      })
        .then((response) => {
          let files = response.rows.filter(row => !row.value || !row.value.deleted);

          if (files.length === 0) {
            resolve([]);
            return;
          }

          files = files.map((row) => {
            delete row.doc.entity;
            return row.doc;
          });

          Helpers.chunkUpdate(this.config, files, CHUNK_UPDATE_SIZE)
            .then(resolve, reject);
        }, reject);
    });
  }

  _removeChildren (entities) {
    return new Promise((resolve, reject) => {
      if (entities.length === 0) {
        resolve([]);
        return;
      }

      entities = entities.map(entity => entity._id);

      Db.connect(this.config).viewAsync('entity', 'byChildren', {
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

      Db.connect(this.config).viewAsync('entity', 'byChildren', {
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

  _updateFiles (files) {
    return new Promise((resolve, reject) => {
      if (files.length === 0) {
        resolve([]);
        return;
      }

      let fileIds = [];
      const fileMap = {};

      files.forEach((file) => {
        if (file.oldId) {
          fileMap[file.oldId] = null;
          fileIds.push(file.oldId);
        }

        if (file.newId) {
          fileMap[file.newId] = file.entity;
          fileIds.push(file.newId);
        }
      });

      fileIds = fileIds.filter(id => _.isString(id));

      Db.connect(this.config).fetchAsync({
        keys: fileIds,
        include_docs: true,
      })
        .then((response) => {
          let files = response.rows.filter(row => !row.value || !row.value.deleted);

          if (files.length === 0) {
            resolve([]);
            return;
          }

          files = files.map((row) => {
            if (fileMap[row.doc._id]) {
              row.doc.entity = {
                id: fileMap[row.doc._id],
              };
            } else {
              delete row.doc.entity;
            }

            return row.doc;
          });

          Helpers.chunkUpdate(this.config, files, CHUNK_UPDATE_SIZE)
            .then(resolve, reject);
        }, reject);
    });
  }

  entityList (query, children = null, parents = null, role = 'guest') {
    return new Promise((resolve, reject) => {
      Db.connect(this.config).viewAsync('entity', 'byId', query)
        .then((result) => {
          result.rows = Entity.consolidateResult(result, children, parents, role);

          if ((!children && !parents) || result.total_rows === 0) {
            resolve(result.rows);
            return;
          }

          this._extendDocs(result.rows, children, parents, role)
            .then((docs) => {
              result.rows = docs;

              resolve(result.rows);
            }, reject);

        }, reject);
    });
  }

  _entitySearch (query, children = null, parents = null, role = 'guest') {
    return new Promise((resolve, reject) => {
      query.limit = Math.min(query.limit ? parseInt(query.limit, 10) : 200, 200);
      query.sort = _.isString(query.sort) ? `"${query.sort}"` : query.sort;

      if (children) {
        query.include_docs = true;
      }

      Db.connect(this.config).searchAsync('entity', query.index || 'all', query)
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
      const limit = query.limit ? parseInt(query.limit, 10) : 25;

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
      result = await Db.connect(this.config).findAsync(query);
    } catch (error) {
      if (error.error === 'no_usable_index') {
        const cc = new ClientConfig(this.config);
        const clientConfig = await cc.get();

        const schema = new Schema(this.config);
        await schema.updateEntityIndex(clientConfig.schemas);

        result = await Db.connect(this.config).findAsync(query);
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
      Db.connect(this.config).getAsync(entityId, {
        revs_info: true,
      })
        .then((response) => {
          const revisionIds = [];

          response._revs_info.forEach((revision) => {
            if (revision.status === 'available') {
              revisionIds.push(revision.rev);
            }
          });

          Db.connect(this.config).getAsync(entityId, {
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

                    if (/image/.test(field.type) && field.value.id) {
                      childrenIds.push(field.value.id);
                    }
                  });
                }
              });

              Db.connect(this.config).fetchAsync({
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

                  resolve(Entity._consolidateChildren(revisions, childrenMap));
                }, reject);
            }, reject);
        }, reject);
    });
  }

  entityCreate (entity) {
    return new Promise((resolve, reject) => {
      entity.type = 'entity';

      Db.connect(this.config).insertAsync(entity)
        .then((response) => {
          entity._id = response.id;
          entity._rev = response.rev;

          const fileIds = Entity._fileIds([entity]);

          if (fileIds.length === 0) {
            resolve(entity);
            return;
          }

          const files = [];

          fileIds.forEach((fileId) => {
            files.push({
              oldId: null,
              newId: fileId,
              entity: entity._id,
            });
          });

          this._updateFiles(files)
            .then(() => {
              resolve(entity);
            }, reject);
        }, reject);
    });
  }

  entityRead (entityId) {
    return new Promise((resolve, reject) => {
      Db.connect(this.config).getAsync(entityId)
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

      Db.connect(this.config).fetchAsync({
        keys: entityIds,
        include_docs: true,
      })
        .then((response) => {
          const children = [];
          const files = [];

          const entities = response.rows.map((row) => {
            const oldEntity = row.doc;
            const newEntity = entityMap[oldEntity._id];

            let entity = oldEntity;

            if (newEntity) {
              delete newEntity._rev;

              const diffs = diff(oldEntity, newEntity);

              diffs.forEach((diff) => {
                if (diff.path[0] === 'fields') {
                  const oldField = oldEntity.fields[diff.path[1]];
                  const newField = newEntity.fields[diff.path[1]];

                  if (newField && newField.value) {
                    if (newField.value.type === 'file' && (diff.path[3] === 'id' || (diff.rhs && diff.rhs.value))) {
                      files.push({
                        oldId: oldField ? oldField.value.id : null,
                        newId: newField.value.id,
                        entity: newEntity._id,
                      });
                    }
                  }
                }

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
              this._updateFiles(files)
                .then(() => {
                  Helpers.chunkUpdate(this.config, entities, CHUNK_UPDATE_SIZE)
                    .then(resolve, reject);
                }, reject);
            }, reject);
        }, reject);
    });
  }

  entityDelete (entityIds, forever = false) {
    return new Promise((resolve, reject) => {
      let getEntities;

      if (entityIds === 'trashed') {
        forever = true;

        getEntities = Db.connect(this.config).viewAsync('entity', 'trashed', {
          include_docs: true,
        });

      } else {
        getEntities = Db.connect(this.config).fetchAsync({
          keys: _.isArray(entityIds) ? entityIds : [entityIds],
          include_docs: true,
        });
      }

      getEntities.then((response) => {
        let entities = response.rows.filter(entity => !entity.value || !entity.value.deleted);

        entities = entities.map(entity => entity.doc);

        if (forever) {
          this._removeChildren(entities)
            .then(() => {
              this._detachFiles(entities)
                .then(() => {
                  entities = entities.map(entity => ({
                    _id: entity._id,
                    _rev: entity._rev,
                    _deleted: true,
                  }));

                  Helpers.chunkUpdate(this.config, entities, CHUNK_UPDATE_SIZE)
                    .then(resolve, reject);
                }, reject);
            }, reject);
        } else {
          entities = entities.map((entity) => {
            entity.trashed = true;
            return entity;
          });

          Helpers.chunkUpdate(this.config, entities, CHUNK_UPDATE_SIZE)
            .then(resolve, reject);
        }
      }, reject);
    });
  }

}

module.exports = Entity;
