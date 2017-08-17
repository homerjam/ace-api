module.exports = function(head, req) {
  // var _ = require('lib/lodash');
  var Fuse = require('lib/fuse');

  var row;
  var rows = [];
  while (row = getRow()) {
    rows.push(row);
  }

  rows = rows.filter(function(row) { return row.key; });

  rows = rows.map(function(row) {
    return {
      value: row.key[1],
    };
  });

  var options = {
    shouldSort: true,
    threshold: 0.6,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 1,
    keys: [
      'value',
    ],
  };

  if (req.query.searchTerm) {
    var fuse = new Fuse(rows, options);
    rows = fuse.search(req.query.searchTerm);
  }

  rows = rows.map(function(row) { return row.value; });

  send(toJSON({ rows: rows }));
};
