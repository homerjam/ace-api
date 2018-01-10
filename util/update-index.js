const Promise = require('bluebird');
const Cloudant = require('cloudant');
const Schema = require('../lib/schema');

const args = process.argv.slice(2);

if (!args[1]) {
  throw Error('No db specified');
}

args.forEach(async (dbName) => {
  const db = Promise.promisifyAll(Cloudant({
    url: args[0],
  }).db.use(dbName));

  const clientConfig = await db.get('config');

  const schema = new Schema({
    db: {
      url: args[0],
      name: dbName,
    },
  });

  const result = await schema.updateEntityIndex(clientConfig.schemas);

  console.log(`${dbName} --> entity index updated`);
});
