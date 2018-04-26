console.time('startup');

require('./server/server')();

console.timeEnd('startup');
