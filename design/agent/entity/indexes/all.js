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

    index('sort.modified', new Date(Date.parse(doc.modified || 0)).getTime(), {
      store: false,
      index: 'not_analyzed',
    });

    function unique (v, i, self) {
      return self.indexOf(v) === i;
    }

    function indexFields (fields) {
      for (var fieldSlug in fields) {
        var fieldValue = fields[fieldSlug].value;
        var fieldType = fields[fieldSlug].fieldType;

        var indexValue = null;
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
              if (obj.type === 'entity' || obj.type === 'option') {
                titles.push(obj.title);
                slugs.push(obj.slug);
              }

              if (obj.type === 'keyValue') {
                titles.push(obj.value);
                slugs.push(obj.value);
              }
            });

            titles = titles.filter(unique);
            slugs = slugs.filter(unique);

            indexValue = indexSortValue = titles.length ? titles.join(', ') : 'NULL';
            indexSlugValue = slugs.length ? slugs.join(', ') : 'NULL';
          }

          if (fieldValueObjectType === '[object Object]') {
            var fieldValueType = fieldValue.type;

            if (fieldType === 'entity' || fieldValueType === 'option') {
              indexValue = indexSortValue = fieldValue.title;
              indexSlugValue = fieldValue.slug;
            }

            if (fieldType === 'richText') {
              indexValue = fieldValue.html ? fieldValue.html.replace(/(<([^>]+)>)/ig, '') : 'NULL';
            }

            if (fieldType === 'taxonomy') {
              titles = [];
              slugs = [];

              var terms = toString.call(fieldValue.terms) === '[object Array]' ? fieldValue.terms : [];

              terms.forEach(function (term) {
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

              indexValue = indexSortValue = titles.length ? titles.join(', ') : 'NULL';
              indexSlugValue = slugs.length ? slugs.join(', ') : 'NULL';
            }

            if (fieldType === 'file') {
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

          if (fieldValueObjectType === '[object String]' || fieldValueObjectType === '[object Number]') {
            if (/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/.test(fieldValue)) {
              indexValue = fieldValue;
              indexSortValue = new Date(Date.parse(fieldValue)).getTime();

            } else {
              fieldValue = fieldValue === null || fieldValue === undefined ? 'NULL' : fieldValue;
              indexValue = indexSortValue = fieldValue;
            }
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
