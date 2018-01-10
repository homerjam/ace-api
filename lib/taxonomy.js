const _ = require('lodash');
const Db = require('./db');
const ClientConfig = require('./client-config');

class Taxonomy {
  constructor(config) {
    this.config = config;
  }

  async create(taxonomy) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    clientConfig.taxonomies.push(taxonomy);

    return cc.set(clientConfig);
  }

  async read(taxonomySlug) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    const taxonomy = _.find(clientConfig.taxonomies, { slug: taxonomySlug });

    if (!taxonomy) {
      throw Error(`Taxonomy not found: ${taxonomySlug}`);
    }

    return taxonomy;
  }

  async update(taxonomy) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    const index = _.findIndex(clientConfig.taxonomies, { slug: taxonomy.slug });

    if (index === -1) {
      throw Error(`Taxonomy not found: ${taxonomy.slug}`);
    }

    clientConfig.taxonomies.splice(index, 1, taxonomy);

    return cc.set(clientConfig);
  }

  async delete(taxonomySlug) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    taxonomySlug = _.isArray(taxonomySlug) ? taxonomySlug : [taxonomySlug];

    clientConfig.taxonomies = clientConfig.taxonomies.filter(taxonomy => taxonomySlug.indexOf(taxonomy.slug) === -1);

    return cc.set(clientConfig);
  }

  async entitiesByTerm(term) {
    const db = Db.connect(this.config);

    const entityGroups = (await db.view('entity', 'byTaxonomyTerm', { keys: [term.id], group: true })).rows.map(row => row.value)[0];

    if (!entityGroups) {
      return [];
    }

    let entityIds = [];

    _.forEach(entityGroups, (entities) => {
      entityIds = entityIds.concat(entities);
    });

    entityIds = _.uniq(entityIds);

    return (await db.fetch({ keys: entityIds, include_docs: true })).rows.map(row => row.doc);
  }

  async createTerm(taxonomySlug, term) {
    const taxonomy = await this.read(taxonomySlug);

    taxonomy.terms.push(term);

    return this.update(taxonomy);
  }

  async updateTerm(term) {
    let entities = await this.entitiesByTerm(term);

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

    return Db.connect(this.config).bulk({ docs: entities });
  }

  async deleteTerm(term) {
    let entities = await this.entitiesByTerm(term);

    entities = entities.map((entity) => {
      entity.fields = _.mapValues(entity.fields, (field) => {
        if (field.type === 'taxonomy' && field.value) {
          if (!field.value.terms) {
            field.value.terms = [];
          }

          field.value.terms = field.value.terms.filter((_term) => {
            if (_term.id === term.id) {
              return false;
            }

            if ((_term.parents || []).filter(parent => parent.id === term.id).length) {
              return false;
            }

            return true;
          });
        }

        return field;
      });
      return entity;
    });

    return Db.connect(this.config).bulk({ docs: entities });
  }
}

module.exports = Taxonomy;
