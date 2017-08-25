module.exports = function (doc) {
  if (doc.type === 'entity') {

    index('schema', doc.schema, {
      store: false,
      index: 'analyzed',
    });

    index('sort.schema', doc.schema, {
      store: false,
      index: 'not_analyzed',
    });

    index('trashed', doc.trashed || false, {
      store: false,
      index: 'not_analyzed',
    });

    index('title', doc.title, {
      store: false,
      index: 'analyzed',
    });

    index('sort.title', doc.title, {
      store: false,
      index: 'not_analyzed',
    });

    index('slug', doc.slug, {
      store: false,
      index: 'analyzed',
    });

    index('sort.slug', doc.slug, {
      store: false,
      index: 'not_analyzed',
    });

    index('published', doc.published || false, {
      store: false,
      index: 'not_analyzed',
    });

    index('publishedAt', doc.published ? doc.publishedAt : false, {
      store: false,
      index: 'not_analyzed',
    });

    index('sort.publishedAt', doc.publishedAt && (doc.published || false) ? new Date(Date.parse(doc.publishedAt)).getTime() : 0, {
      store: false,
      index: 'not_analyzed',
    });

    index('sort.modifiedAt', new Date(Date.parse(doc.modifiedAt || 0)).getTime(), {
      store: false,
      index: 'not_analyzed',
    });

    function unique (v, i, self) {
      return self.indexOf(v) === i;
    }

    function indexFields (fields) {
      for (var fieldSlug in fields) {
        var fieldValue = fields[fieldSlug].value;
        var fieldType = fields[fieldSlug].type;

        var indexValue = 'NULL';
        var indexSortValue = null;
        var indexSlugValue = null;

        var titles;
        var slugs;

        var fieldValueObjectType = toString.call(fieldValue);

        if (fieldValue) {

          if (fieldValueObjectType === '[object Array]') {
            titles = [];
            slugs = [];

            fieldValue.forEach(function (obj) {
              if (obj.title) {
                titles.push(obj.title);
              }
              if (obj.slug) {
                slugs.push(obj.slug);
              }
            });

            titles = titles.filter(unique);
            slugs = slugs.filter(unique);

            if (titles.length) {
              indexValue = titles.join(', ');
              indexSortValue = indexValue;
            }
            if (slugs.length) {
              indexSlugValue = slugs.join(', ');
            }
          }

          if (fieldValueObjectType === '[object Object]') {

            if (fieldValue.html) {
              indexValue = fieldValue.html ? fieldValue.html.replace(/(<([^>]+)>)/ig, '') : 'NULL';
            }

            if (fieldValue.terms && fieldValue.terms.length) {
              titles = [];
              slugs = [];

              fieldValue.terms.forEach(function (term) {
                titles.push(term.title);
                slugs.push(term.slug);

                var parents = term.parents || [];

                parents.forEach(function (parent) {
                  titles.push(parent.title);
                  slugs.push(parent.slug);
                });
              });

              titles = titles.filter(unique);
              slugs = slugs.filter(unique);

              if (titles.length) {
                indexValue = titles.join(', ');
                indexSortValue = indexValue;
              }
              if (slugs.length) {
                indexSlugValue = slugs.join(', ');
              }
            }

            if (fieldType === 'file') {
              indexValue = null;

              index('fields.' + fieldSlug + '.fileName', fieldValue.fileName || '', {
                store: false,
                index: 'analyzed',
              });

              index('fields.' + fieldSlug + '.original.fileName', fieldValue.original.fileName, {
                store: false,
                index: 'analyzed',
              });
            }

          }

          if (fieldValueObjectType === '[object String]') {

            indexValue = fieldValue;

            if (/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/.test(fieldValue)) {
              indexSortValue = new Date(Date.parse(fieldValue)).getTime();
            } else {
              indexSortValue = indexValue;
            }

          }

          if (fieldValueObjectType === '[object Number]') {

            indexValue = fieldValue;
            indexSortValue = indexValue;

          }

          if (indexValue) {
            index('fields.' + fieldSlug, indexValue, {
              store: false,
              index: 'analyzed',
            });
          }

          if (indexSortValue) {
            index('sort.fields.' + fieldSlug, indexSortValue, {
              store: false,
              index: 'not_analyzed',
            });
          }

          if (indexSlugValue) {
            index('fields.' + fieldSlug + '.slug', indexSlugValue, {
              store: false,
              index: 'analyzed',
            });
          }

        }
      }
    }

    indexFields(doc.fields);
  }
};
