var ddoc = {
  _id: '_design/taxonomy',
  views: {
    byKey: {
      map: function(doc) {
        if (doc.type === 'taxonomy') {
          emit(doc.slug, null);
        }
      },
    },
    flattened: {
      map: function(doc) {
        if (doc.type === 'taxonomy') {

          function get(term, parents) {
            if (term.terms.length) {
              var newParents = parents.slice(0);

              newParents.push({
                slug: term.slug,
                title: term.title,
              });

              term.terms.forEach(function(term) {
                get(term, newParents);
              });

            } else {
              term.parents = parents;

              delete term.terms;

              emit(doc._id, {
                id: term.id,
                slug: term.slug,
                title: term.title,
                parents: parents,
              });
            }
          }

          doc.terms.forEach(function(term) {
            get(term, []);
          });

        }
      },
    },
  },
};

module.exports = ddoc;
