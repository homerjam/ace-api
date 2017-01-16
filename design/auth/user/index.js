var ddoc = {
  _id: '_design/user',
  views: {
    byKey: {
      map: function(doc) {
        if (doc.type === 'user') {
          emit(doc.email, {
            email: doc.email,
            slug: doc.slug,
          });
        }
      },
    },
  },
};

module.exports = ddoc;
