const _ = require('lodash');
const Promise = require('bluebird');
const Db = require('./db');
const Helpers = require('./helpers');

class Taxonomy {
  constructor(config) {
    this.config = config;
  }

  // create(taxonomy) {
  //   return new Promise((resolve, reject) => {
  //     Helpers.createOrUpdate(this.config, taxonomy)
  //       .then(resolve, reject);
  //   });
  // }

  update(taxonomy) {
    return new Promise((resolve, reject) => {
      Helpers.createOrUpdate(this.config, taxonomy)
        .then(resolve, reject);
    });
  }

  read(taxonomySlug) {
    return new Promise((resolve, reject) => {
      Db.connect(this.config).viewAsync('taxonomy', 'bySlug', {
        key: taxonomySlug,
        include_docs: true,
      })
        .then((body) => {
          if (!body.rows.length) {
            reject({
              code: 404,
              message: `Taxonomy not found: ${taxonomySlug}`,
            });
            return;
          }

          resolve(body.rows[0].doc);
        }, reject);
    });
  }

  createTerm(taxonomySlug, term, modifierId) {
    return new Promise((resolve, reject) => {
      this.read(taxonomySlug)
        .then((body) => {
          if (body.rows.length === 0) {
            reject({
              statusCode: 404,
              message: 'Taxonomy not found',
            });
            return;
          }

          const taxonomy = body.rows[0].doc;

          if (!taxonomy.terms) {
            taxonomy.terms = [];
          }

          taxonomy.terms.push(term);
          taxonomy.modified = new Date();
          taxonomy.modifiedBy = modifierId;

          Db.connect(this.config).insertAsync(taxonomy)
            .then(resolve, reject);
        });
    });
  }

  updateTerm(updatedTerm) {
    return new Promise((resolve, reject) => {
      Db.connect(this.config).viewAsync('entity', 'byTaxonomyTerm', {
        keys: [updatedTerm.id],
        group: true,
      })
        .then((body) => {
          if (!body.rows.length) {
            reject({
              statusCode: 204,
              message: 'Term unused',
            });
            return;
          }

          let ids = [];

          _.forEach(body.rows, (row) => {
            _.forEach(row.value, (entityIds) => {
              _.forEach(entityIds, (entityId) => {
                ids.push(entityId);
              });
            });
          });

          ids = _.uniq(ids);

          Db.connect(this.config).fetchAsync({
            keys: ids,
            include_docs: true,
          })
            .then((body) => {
              const docs = body.rows.map((row) => {
                const doc = row.doc;

                doc.fields = _.mapValues(doc.fields, (field) => {
                  if (field.value && field.value.type === 'taxonomy') {
                    if (!field.value.terms) {
                      field.value.terms = [];
                    }

                    field.value.terms = field.value.terms.map((term) => {
                      if (term.id === updatedTerm.id) {
                        term.title = updatedTerm.title;
                        term.slug = updatedTerm.slug;
                      }

                      if (!term.parents) {
                        term.parents = [];
                      }

                      term.parents = term.parents.map((parent) => {
                        if (parent.id === updatedTerm.id) {
                          parent.title = updatedTerm.title;
                          parent.slug = updatedTerm.slug;
                        }
                        return parent;
                      });

                      return term;
                    });
                  }

                  return field;
                });

                return doc;
              });

              Db.connect(this.config).bulkAsync({
                docs,
              }).then(resolve, reject);
            }, reject)
            .catch(reject);
        }, reject);
    });
  }

  deleteTerm(deletedTerm) {
    return new Promise((resolve, reject) => {
      Db.connect(this.config).viewAsync('entity', 'byTaxonomyTerm', {
        keys: [deletedTerm.id],
        group: true,
      })
        .then((body) => {
          if (!body.rows.length) {
            reject({
              statusCode: 204,
              message: 'Term unused',
            });
            return;
          }

          const ids = [];

          body.rows.forEach((row) => {
            if (_.isArray(row.value)) {
              row.value.forEach((id) => {
                ids.push(id);
              });
            }
            if (_.isString(row.value)) {
              ids.push(row.value);
            }
          });

          Db.connect(this.config).fetchAsync({
            keys: ids,
            include_docs: true,
          })
            .then((body) => {
              const docs = body.rows.map((row) => {
                const doc = row.doc;

                doc.fields = _.mapValues(doc.fields, (field) => {
                  if (field.value && field.value.type === 'taxonomy') {
                    if (!field.value.terms) {
                      field.value.terms = [];
                    }

                    field.value.terms = field.value.terms.filter((term) => {
                      let keepTerm = true;

                      if (term.id === deletedTerm.id) {
                        keepTerm = false;
                      }

                      if (!term.parents) {
                        term.parents = [];
                      }

                      term.parents.forEach((parent) => {
                        if (parent.id === deletedTerm.id) {
                          keepTerm = false;
                        }
                      });

                      return keepTerm;
                    });
                  }

                  return field;
                });

                return doc;
              });

              Db.connect(this.config).bulkAsync({
                docs,
              }).then(resolve, reject);
            }, reject);
        }, reject);
    });
  }

}

module.exports = Taxonomy;
