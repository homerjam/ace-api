const _ = require('lodash');
const { diff } = require('deep-diff');
const Db = require('./db');
const Utils = require('./utils');

class Taxonomy {
  constructor(config) {
    this.config = config;
  }

  async create(taxonomy) {
    taxonomy = await this.update(taxonomy);
    return taxonomy;
  }

  async read(taxonomySlug) {
    const taxonomy = await Db.connect(this.config).get(
      `taxonomy.${taxonomySlug}`
    );

    if (!taxonomy) {
      throw Error(`Taxonomy not found '${taxonomySlug}'`);
    }

    return taxonomy;
  }

  async update(taxonomy) {
    if (!taxonomy.slug) {
      throw Error(`Taxonomy requires 'slug'`);
    }

    const oldTaxonomy = await this.read(taxonomy.slug);

    if (oldTaxonomy) {
      const changes = diff(oldTaxonomy, taxonomy);

      // TODO: get diff and update/delete terms

      console.log(changes);

      // const deletedTerms = [];

      // changes.forEach((change) => {
      //   if (change.kind === 'A' && change.item.kind === 'D') {
      //     const path = change.path.concat([change.index - 1]);
      //     const term = _.get(oldTaxonomy, path);
      //     if (term) {
      //       deletedTerms.push({
      //         path,
      //         term,
      //       });
      //     }
      //   }
      // });

      // console.log(deletedTerms);

      // const updatedTerms = [];

      // changes.forEach((change) => {
      //   if (change.kind === 'E') {
      //     updatedTerms.push(_.get(oldTaxonomy, change.path.slice(0, -1)));
      //   }
      // });

      // updatedTerms = _.uniqBy(updatedTerms, 'id');

      // console.log(updatedTerms);
    }

    taxonomy._id = `taxonomy.${taxonomy.slug}`;
    taxonomy.type = 'taxonomy';

    taxonomy = await Utils.createOrUpdate(this.config, taxonomy);

    return taxonomy;
  }

  async delete(taxonomySlug) {
    let taxonomy = await this.read(taxonomySlug);

    taxonomy._deleted = true;

    taxonomy = await Utils.createOrUpdate(this.config, taxonomy);

    return taxonomy;
  }

  async entitiesByTerm(termId) {
    const db = Db.connect(this.config);

    const entityGroups = (
      await db.view('entity', 'byTaxonomyTerm', {
        keys: [termId],
        group: true,
      })
    ).rows.map((row) => row.value)[0];

    if (!entityGroups) {
      return [];
    }

    let entityIds = [];

    _.forEach(entityGroups, (entities) => {
      entityIds = entityIds.concat(entities);
    });

    entityIds = _.uniq(entityIds);

    const entities = (
      await db.fetch({ keys: entityIds, include_docs: true })
    ).rows
      .filter((row) => row.doc)
      .map((row) => row.doc);

    return entities;
  }

  async createTerm(taxonomySlug, term) {
    const taxonomy = await this.read(taxonomySlug);

    taxonomy.terms.push(term);

    return this.update(taxonomy);
  }

  async updateTerm(term) {
    let entities = await this.entitiesByTerm(term.id);

    entities = entities.map((entity) => {
      entity.fields = _.mapValues(entity.fields, (field) => {
        if (field.type === 'taxonomy' && field.value) {
          if (!field.value.terms) {
            field.value.terms = [];
          }

          field.value.terms = field.value.terms.map((_term) => {
            if (_term.id === term.id) {
              _term.title = term.title;
              _term.slug = term.slug;
            }

            if (!_term.parents) {
              _term.parents = [];
            }

            _term.parents = _term.parents.map((parent) => {
              if (parent.id === term.id) {
                parent.title = term.title;
                parent.slug = term.slug;
              }
              return parent;
            });

            return _term;
          });
        }

        return field;
      });
      return entity;
    });

    const result = await Utils.chunkBulk(this.config, entities);

    return result;
  }

  async deleteTerm(termId) {
    let entities = await this.entitiesByTerm(termId);

    entities = entities.map((entity) => {
      entity.fields = _.mapValues(entity.fields, (field) => {
        if (field.type === 'taxonomy' && field.value) {
          if (!field.value.terms) {
            field.value.terms = [];
          }

          field.value.terms = field.value.terms.filter((_term) => {
            if (_term.id === termId) {
              return false;
            }

            if (
              (_term.parents || []).filter((parent) => parent.id === termId)
                .length
            ) {
              return false;
            }

            return true;
          });
        }

        return field;
      });
      return entity;
    });

    const result = await Utils.chunkBulk(this.config, entities);

    return result;
  }
}

module.exports = Taxonomy;
