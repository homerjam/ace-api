const _ = require('lodash');
const Promise = require('bluebird');
const diff = require('deep-diff').diff;
const Helpers = require('./helpers');

class Entity {
  constructor (db) {
    this.db = db;
  }

  static mapChildren (docs, children, isRow) {
    let childrenMap = {};

    children.forEach((doc) => {
      // Prevent circular reference error
      childrenMap[doc._id] = _.clone(doc);
    });

    docs = docs.map((doc) => {
      const child = childrenMap[doc.id || doc._id];

      if (child) {
        if (doc.doc || isRow) {
          doc.doc = child;
        } else {
          doc = child;
        }
      }

      return doc;
    });

    childrenMap = null;

    return docs;
  }

  static flattenValues (docs) {
    if (!_.isArray(docs)) {
      return docs;
    }

    return docs.map((doc) => {
      if (doc && doc.fields) {
        if (_.size(doc.fields)) {
          doc.fields = _.mapValues(doc.fields, (field) => {
            if (/entity/.test(field.fieldType)) {
              field.value = Entity.flattenValues(field.value);
            }
            return field.value;
          });
        }
      }
      return doc;
    });
  }

  static filterEntityFields (docs, isAuthorised) {
    return docs.map((doc) => {
      if (_.size(doc.fields)) {
        doc.fields = _.mapValues(doc.fields, (field) => {
          if (_.isArray(field.value)) {
            field.value = field.value.filter((obj) => {
              if (obj.type === 'entity' && !isAuthorised) {
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
    docs = docs.map((doc) => {
      if (_.size(doc.fields)) {
        doc.fields = _.mapValues(doc.fields, (field) => {

          if (_.isArray(field.value)) {
            field.value = field.value.filter((obj) => {
              if (obj.type === 'entity') {
                return childrenMap[obj.id] !== undefined;
              }
              return true;
            });

            field.value = field.value.map((obj) => {
              if (obj.type === 'entity') {
                obj = _.extend(obj, childrenMap[obj.id]);
              }
              obj = _.omitBy(obj, (value, key) => key.startsWith('_'));
              return obj;
            });
          }

          if (_.isObject(field.value)) {
            if (field.value.type === 'file' && childrenMap[field.value.id]) {
              field.value = _.extend(field.value, childrenMap[field.value.id]);
              field.value = _.omitBy(field.value, (value, key) => key.startsWith('_'));
            }
          }

          return field;
        });
      }

      return doc;
    });

    return docs;
  }

  static consolidateResult (result, children, parents, isAuthorised) {
    let docs = [];
    let entityMap = {};
    let childrenMap = {};

    result.rows.forEach((row) => {
      if (row.doc && row.value.type === 'entity') {
        const entity = row.doc;

        entityMap[row.key] = entity;

        docs.push(entity);
      }
    });

    if (children) {
      result.rows.forEach((row) => {
        if (row.doc && row.value.type === 'field') {
          childrenMap[row.doc._id] = Entity.filterEntityFields([row.doc], isAuthorised)[0];
        }
      });

      docs = Entity._consolidateChildren(docs, childrenMap);
    }

    if (parents) {
      result.rows.forEach((row) => {
        if (!entityMap[row.key].parents) {
          entityMap[row.key].parents = [];
        }
        if (!entityMap[row.key]._parentsMap) {
          entityMap[row.key]._parentsMap = {};
        }

        if (row.doc && row.value.type === 'parent') {
          const parent = Entity.filterEntityFields([row.doc], isAuthorised)[0];

          if (!entityMap[row.key]._parentsMap[parent._id]) {
            entityMap[row.key]._parentsMap[parent._id] = true;

            entityMap[row.key].parents.push(Entity.filterEntityFields([row.doc], isAuthorised)[0]);
          }
        }
      });
    }

    result.rows.forEach((row) => {
      if (entityMap[row.key]._parentsMap) {
        delete entityMap[row.key]._parentsMap;
      }
    });

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

  entitiesById (ids, children, parents, isAuthorised) {
    return new Promise((resolve, reject) => {
      if (ids.length === 0) {
        resolve([]);
        return;
      }
      this.db().viewAsync('entity', 'byId', {
        keys: ids,
        include_docs: true,
      })
        .then((result) => {
          const docs = Entity.consolidateResult(result, children, parents, isAuthorised);
          resolve(docs);
        }, reject);
    });
  }

  _extendDocs (docs, children, parents, isAuthorised, childDepth = 1) {
    return new Promise((resolve, reject) => {
      // get ids
      const ids = docs.map(doc => doc.id || doc._id);

      // get entity(s) and consolidate children
      this.entitiesById(ids, children, parents, isAuthorised)
        .then((_docs) => {
          // filter entityField(s)
          _docs = Entity.filterEntityFields(_docs, isAuthorised);

          // map/merge entity(s)
          docs = Entity.mapChildren(docs, _docs);

          // resolve promise if extend depth reached
          if (childDepth === children) {
            resolve(docs);
            return;
          }

          childDepth += 1;

          const promises = [];

          // extend entityField(s)
          docs = docs.map((doc) => {
            if (_.size(doc.fields)) {
              doc.fields = _.mapValues(doc.fields, (field) => {
                if (/entity/.test(field.fieldType)) {
                  promises.push(new Promise((resolve, reject) => {
                    this._extendDocs(field.value, children, parents, isAuthorised, childDepth)
                      .then((docs) => {
                        field.value = _.merge(field.value, docs);
                        resolve();
                      }, reject);
                  }));
                }
                return field;
              });
            }
            return doc;
          });

          Promise.all(promises).then(() => {
            resolve(docs);
          }, reject);
        }, reject);
    });
  }

  _detachFiles (entities) {
    return new Promise((resolve, reject) => {
      const fileIds = Entity._fileIds(entities);

      if (fileIds.length === 0) {
        resolve([]);
        return;
      }

      this.db().fetchAsync({
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

          Helpers.chunkUpdate(this.db, files, 1000)
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

      this.db().viewAsync('entity', 'children', {
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

          Helpers.chunkUpdate(this.db, updatedEntities, 1000)
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

      this.db().viewAsync('entity', 'children', {
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

          Helpers.chunkUpdate(this.db, entities, 1000)
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

      this.db().fetchAsync({
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

          Helpers.chunkUpdate(this.db, files, 1000)
            .then(resolve, reject);
        }, reject);
    });
  }

  entityList (query, view = 'byId', list = null, children = false, parents = false, isAuthorised = false) {
    return new Promise((resolve, reject) => {
      let fn;

      if (list) {
        fn = this.db().viewWithListAsync('entity', view, list, query);
      } else {
        fn = this.db().viewAsync('entity', view, query);
      }

      fn
        .then((result) => {
          result.rows = Entity.consolidateResult(result, children, parents, isAuthorised);

          if ((!children && !parents) || result.total_rows === 0) {
            resolve(result.rows);
            return;
          }

          this._extendDocs(result.rows, children, parents, isAuthorised)
            .then((docs) => {
              result.rows = Entity.mapChildren(result.rows, docs);

              resolve(result.rows);
            }, reject);

        }, reject);
    });
  }

  _entitySearch (query, children, parents, isAuthorised) {
    return new Promise((resolve, reject) => {
      query.limit = Math.min(query.limit ? parseInt(query.limit, 10) : 200, 200);
      query.sort = _.isString(query.sort) ? '"' + query.sort + '"' : query.sort;

      this.db().searchAsync('entity', query.index || 'all', query)
        .then((result) => {

          if (result.groups) {
            const promises = [];

            result.groups = result.groups.map((group) => {
              promises.push(new Promise((resolve, reject) => {
                if ((!children && !parents) || group.total_rows === 0) {
                  resolve();
                  return;
                }

                this._extendDocs(group.rows, children, parents, isAuthorised)
                  .then((docs) => {
                    group.rows = Entity.mapChildren(group.rows, docs, true);
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

          this._extendDocs(result.rows, children, parents, isAuthorised)
            .then((docs) => {
              result.rows = Entity.mapChildren(result.rows, docs, true);

              resolve(result);
            }, reject);
        }, reject);
    });
  }

  entitySearch (query, children, parents, isAuthorised) {
    return new Promise((resolve, reject) => {
      const limit = parseInt(query.limit, 10);

      if (limit <= 200) {
        this._entitySearch(query, children, parents, isAuthorised)
          .then(resolve, reject);
        return;
      }

      let rows = [];

      function __entitySearch (bookmark) {
        const _query = _.clone(query);

        if (bookmark) {
          _query.bookmark = bookmark;
        }

        this._entitySearch(_query, children, parents, isAuthorised)
          .then((result) => {
            rows = rows.concat(result.rows);

            if (rows.length < result.total_rows && rows.length < limit) {
              __entitySearch.call(this, result.bookmark);
              return;
            }

            result.rows = rows;

            resolve(result);
          }, reject);
      }

      __entitySearch.call(this);
    });
  }

  entityFind (query, children, parents, isAuthorised) {
    return new Promise((resolve, reject) => {
      this.db().findAsync(query)
        .then((result) => {
          if (children === false) {
            resolve(result);
            return;
          }

          if (query.fields && query.fields.indexOf('_id') === -1) {
            reject('_id field required for `children`');
            return;
          }

          this._extendDocs(result.docs, children, parents, isAuthorised)
            .then((docs) => {
              result.docs = Entity.mapChildren(result.docs, docs);

              resolve(result);
            }, reject);
        }, reject);
    });
  }

  // TODO: replace query with explicit params
  entityFilterValues (query) {
    return new Promise((resolve, reject) => {
      query.include_docs = true;
      this.db().viewWithListAsync('entity', 'active', 'values', query)
        .then(resolve, reject);
    });
  }

  entityRevisions (entityId) {
    return new Promise((resolve, reject) => {
      this.db().getAsync(entityId, {
        revs_info: true,
      })
        .then((response) => {
          const revisionIds = [];

          response._revs_info.forEach((revision) => {
            if (revision.status === 'available') {
              revisionIds.push(revision.rev);
            }
          });

          this.db().getAsync(entityId, {
            open_revs: JSON.stringify(revisionIds),
          })
            .then((response) => {
              const revisions = [];
              const childrenIds = [];

              response.forEach((revision) => {
                if (revision.ok) {
                  revisions.push(revision.ok);

                  _.forEach(revision.ok.fields, (field) => {
                    if (/entity/.test(field.fieldType)) {
                      _.forEach(field.value, (obj) => {
                        if (obj.id) {
                          childrenIds.push(obj.id);
                        }
                      });
                    }

                    if (/image/.test(field.fieldType) && field.value.id) {
                      childrenIds.push(field.value.id);
                    }
                  });
                }
              });

              this.db().fetchAsync({
                keys: _.uniq(childrenIds),
                include_docs: true,
              })
                .then((result) => {
                  const childrenMap = {};

                  result.rows.forEach((row) => {
                    childrenMap[row.doc._id] = row.doc;
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

      this.db().insertAsync(entity)
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
      this.db().getAsync(entityId)
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

      this.db().fetchAsync({
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

              entity = _.mergeWith(oldEntity, newEntity, (a, b) => {
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
                  Helpers.chunkUpdate(this.db, entities, 1000)
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

        getEntities = this.db().viewAsync('entity', 'trashed', {
          include_docs: true,
        });

      } else {
        getEntities = this.db().fetchAsync({
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

                  Helpers.chunkUpdate(this.db, entities, 1000)
                    .then(resolve, reject);
                }, reject);
            }, reject);
        } else {
          entities = entities.map((entity) => {
            entity.trashed = true;
            return entity;
          });

          Helpers.chunkUpdate(this.db, entities, 1000)
            .then(resolve, reject);
        }
      }, reject);
    });
  }

}

module.exports = Entity;
