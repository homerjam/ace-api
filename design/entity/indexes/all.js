/* global index  */

module.exports = function(doc) {
  if (doc.type === 'entity') {
    index('id', doc._id, {
      store: true,
      index: 'not_analyzed',
    });

    index('schema', doc.schema, {
      store: true,
      index: 'analyzed',
    });

    index('sort.schema', doc.schema, {
      store: false,
      index: 'not_analyzed',
    });

    index('trashed', doc.trashed || false, {
      store: true,
      index: 'not_analyzed',
    });

    index('title', doc.title, {
      store: true,
      index: 'analyzed',
    });

    index('sort.title', doc.title, {
      store: false,
      index: 'not_analyzed',
    });

    index('slug', doc.slug, {
      store: true,
      index: 'analyzed',
    });

    index('sort.slug', doc.slug, {
      store: false,
      index: 'not_analyzed',
    });

    index('published', doc.published || false, {
      store: true,
      index: 'not_analyzed',
    });

    index('publishedAt', doc.published ? doc.publishedAt : false, {
      store: true,
      index: 'not_analyzed',
    });

    index(
      'sort.publishedAt',
      doc.publishedAt && (doc.published || false)
        ? new Date(Date.parse(doc.publishedAt)).getTime()
        : 0,
      {
        store: false,
        index: 'not_analyzed',
      }
    );

    index(
      'sort.modifiedAt',
      new Date(Date.parse(doc.modifiedAt || 0)).getTime(),
      {
        store: false,
        index: 'not_analyzed',
      }
    );

    function unique(v, i, self) {
      return self.indexOf(v) === i;
    }

    function decodeHTMLEntities(text) {
      var entities = [
        ['amp', '&'],
        ['apos', "'"],
        ['#x27', "'"],
        ['#x2F', '/'],
        ['#39', "'"],
        ['#47', '/'],
        ['lt', '<'],
        ['gt', '>'],
        ['nbsp', ' '],
        ['quot', '"'],
      ];
      for (var i = 0, max = entities.length; i < max; ++i) {
        text = text.replace(
          new RegExp('&' + entities[i][0] + ';', 'g'),
          entities[i][1]
        );
      }
      return text;
    }

    function indexFields(fields) {
      for (var fieldSlug in fields) {
        var fieldValue = fields[fieldSlug].value;
        // var fieldType = fields[fieldSlug].type;

        var indexValue = 'NULL';
        var indexSortValue;
        var indexSlugValue;

        var titles;
        var slugs;

        var fieldValueObjectType = toString.call(fieldValue);

        if (typeof fieldValue !== 'undefined') {
          if (fieldValueObjectType === '[object Array]') {
            titles = [];
            slugs = [];

            fieldValue.forEach(function(obj) {
              if (!obj) {
                return;
              }
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
              indexValue = fieldValue.html
                .replace(/(<([^>]+)>)/gi, ' ')
                .replace(/\s\s/g, ' ')
                .replace(/\r|\n/, '')
                .trim();
              indexValue = decodeHTMLEntities(indexValue);
            }

            if (fieldValue.terms && fieldValue.terms.length) {
              titles = [];
              slugs = [];

              fieldValue.terms.forEach(function(obj) {
                if (!obj) {
                  return;
                }
                if (obj.title) {
                  titles.push(obj.title);
                }
                if (obj.slug) {
                  slugs.push(obj.slug);
                }

                var parents = obj.parents || [];

                parents.forEach(function(obj) {
                  if (!obj) {
                    return;
                  }
                  if (obj.title) {
                    titles.push(obj.title);
                  }
                  if (obj.slug) {
                    slugs.push(obj.slug);
                  }
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

            if (fieldValue.file) {
              indexValue = fieldValue.original.fileName;

              index(
                'fields.' + fieldSlug + '.file.name',
                fieldValue.file.name || '',
                {
                  store: true,
                  index: 'analyzed',
                }
              );
              index(
                'fields.' + fieldSlug + '.file.ext',
                fieldValue.file.ext || '',
                {
                  store: true,
                  index: 'analyzed',
                }
              );
            }
          }

          if (fieldValueObjectType === '[object String]') {
            indexValue = fieldValue;

            if (
              /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/.test(
                fieldValue
              )
            ) {
              indexSortValue = new Date(Date.parse(fieldValue)).getTime();
            } else {
              indexSortValue = indexValue;
            }
          }

          if (fieldValueObjectType === '[object Number]') {
            indexValue = fieldValue;
            indexSortValue = indexValue;
          }

          if (fieldValueObjectType === '[object Boolean]') {
            indexValue = fieldValue;
            indexSortValue = indexValue;
          }

          if (typeof indexValue !== 'undefined' && indexValue !== null) {
            index('fields.' + fieldSlug, indexValue, {
              store: true,
              index: 'analyzed',
            });
          }

          if (typeof indexSortValue !== 'undefined') {
            index('sort.fields.' + fieldSlug, indexSortValue, {
              store: false,
              index: 'not_analyzed',
            });
          }

          if (typeof indexSlugValue !== 'undefined') {
            index('fields.' + fieldSlug + '.slug', indexSlugValue, {
              store: true,
              index: 'analyzed',
            });
          }
        }
      }
    }

    indexFields(doc.fields);
  }
};
