console.time('startup');

require('./server/serve')();

console.timeEnd('startup');
