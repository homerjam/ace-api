var fs = require('fs');

var ddoc = {
  _id: '_design/entity',
  views: {
    lib: {
      lodash: fs.readFileSync('./node_modules/lodash/lodash.min.js').toString('utf8'),
    },
    byFile: {
      map: require('./views/byFile'),
    },
    byId: {
      map: require('./views/byId'),
    },
    byIdExtended: {
      map: require('./views/byIdExtended'),
    },
    byTaxonomyTerm: {
      map: function (doc) {
        if (doc.type === 'entity') {
          for (var key in doc.fields) {
            var field = doc.fields[key];
            if (field.value) {
              var fieldDataType = toString.call(field.value);
              if (fieldDataType === '[object Object]') {
                if (field.value.type === 'taxonomy') {
                  (field.value.terms || []).forEach(function (term) {
                    if (term.id) {
                      emit(term.id, doc._id);
                    }
                    (term.parents || []).forEach(function (parent) {
                      if (parent.id) {
                        emit(parent.id, doc._id);
                      }
                    });
                  });
                }
              }
            }
          }
        }
      },
      reduce: function (keys, values) {
        var unique = function (v, i, self) {
          return self.indexOf(v) === i;
        };

        return values.filter(unique);
      },
    },
    revs: {
      map: function (doc) {
        if (doc.type === 'entity') {
          emit(doc._id, doc._rev);
        }
      },
    },
    active: {
      map: function (doc) {
        if (doc.type === 'entity' && !doc.trashed) {
          emit([doc.schema, doc.modified], null);
        }
      },
    },
    trashed: {
      map: function (doc) {
        if (doc.type === 'entity' && doc.trashed) {
          emit([doc.schema, doc.modified], null);
        }
      },
    },
    children: {
      map: function (doc) {
        if (doc.type === 'entity') {
          for (var key in doc.fields) {
            var field = doc.fields[key].value;

            switch (toString.call(field)) {
              case '[object Array]':
                for (var i in field) {
                  var obj = field[i];
                  if (toString.call(obj) === '[object Object]') {
                    switch (obj.type) {
                      case 'entity':
                        if (obj.id) {
                          emit(obj.id, {
                            _id: doc._id,
                          });
                        }
                        break;
                    }
                  }
                }
                break;
            }
          }
        }
      },
    },
  },
  lists: {
    state: function (head, req) {
      provides('json', function () {
        var rows = [];

        while (row = getRow()) {
          if (req.query.state) {
            switch (req.query.state) {
              case 'published':
                if (row.doc.published && !row.doc.trashed) {
                  rows.push(row);
                }
                break;
              case 'active':
                if (!row.doc.trashed) {
                  rows.push(row);
                }
                break;
              default:
                rows.push(row);
                break;
            }

          } else {
            rows.push(row);
          }
        }

        if (req.query.sort) {
          var sortFields = req.query.sort.split(',');

          sortFields.forEach(function (field) {
            var reverse = field.indexOf('-') === 0;

            field = /[a-zA-Z0-9_\.]+/.exec(field)[0];

            rows = rows.sort(function (a, b) {
              if (['publishedAt', 'modified'].indexOf(field) > -1) {
                a = new Date(Date.parse(a.doc[field].value || 0)).getTime();
                b = new Date(Date.parse(b.doc[field].value || 0)).getTime();

              } else {
                a = a.doc[field].value.toLowerCase();
                b = b.doc[field].value.toLowerCase();
              }

              if (a < b) {
                return reverse ? 1 : -1;
              } else if (a > b) {
                return reverse ? -1 : 1;
              } else {
                return 0;
              }
            });
          });
        }

        var result = head;

        result.list_total_rows = rows.length;
        result.list_offset = 0;
        result.query = req.query;
        result.rows = rows;

        send(JSON.stringify(result));
      });
    },
    filter: function (head, req) {
      provides('json', function () {
        var rows = [],
          re = new RegExp(req.query.searchTerm, 'gim');

        while (row = getRow()) {
          if (req.query.searchTerm) {
            if (req.query.fieldSlug) {
              if (re.test(row.doc.fields[req.query.fieldSlug].value)) {
                row = {};
                row[req.query.fieldSlug] = row.doc.fields[req.query.fieldSlug].value;
                rows.push(row);
              }

            } else {
              var match = false;

              Object.keys(row.doc.fields).forEach(function (key) {
                if (re.test(row.doc.fields[key].value)) {
                  match = true;
                }
              });

              if (match) {
                rows.push(row);
              }
            }

          } else {
            if (req.query.fieldSlug) {
              row = {};
              row[req.query.fieldSlug] = row.doc.fields[req.query.fieldSlug].value;
              rows.push(row);

            } else {
              rows.push(row);
            }
          }
        }

        var result = head;

        result.list_total_rows = rows.length;
        result.list_offset = 0;
        result.query = req.query;
        result.rows = rows;

        send(JSON.stringify(result));
      });
    },
    values: function (head, req) {
      provides('json', function () {
        var values = [],
          re = new RegExp(req.query.searchTerm, 'gim');

        var unique = function (v, i, self) {
          return self.indexOf(v) === i;
        };

        var testField = function (field) {
          switch (toString.call(field)) {
            case '[object Array]':
              field.forEach(function (o) {
                switch (o.type) {
                  case 'entity':
                  case 'option':
                    if (re.test(o.title)) {
                      values.push(o.title);
                    }
                    break;
                }
              });
              break;
            case '[object Object]':
              switch (field.type) {
                case 'entity':
                case 'option':
                  if (re.test(field.title)) {
                    values.push(field.title);
                  }
                  break;
                case 'taxonomy':
                  var terms = [];
                  field.terms.forEach(function (term) {
                    if (re.test(term.title)) {
                      terms.push(term.title);
                    }
                    term.parents.forEach(function (parent) {
                      if (re.test(parent.title)) {
                        terms.push(parent.title);
                      }
                    });
                  });
                  if (terms.length) {
                    values.push(terms);
                  }
                  break;
              }
              break;
            case '[object Function]':
              break;
            default:
              if (re.test(field)) {
                values.push(field);
              }
              break;
          }
        };

        var schemas = req.query.schema.split(',');

        while (row = getRow()) {
          if (schemas.indexOf(row.doc.schema) !== -1) {
            Object.keys(row.doc.fields).forEach(function (key) {
              if (key === req.query.fieldSlug && row.doc.fields[key].value !== null) {
                testField(row.doc.fields[key].value);
              }
            });
          }
        }

        send(JSON.stringify(values.filter(unique)));
      });
    },
  },
  indexes: {
    all: {
      index: require('./indexes/all'),
    },
  },
  fulltext: {
    all: {
      index: require('./indexes/all'),
    },
  },
};

module.exports = ddoc;
