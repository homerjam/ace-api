process.on('unhandledRejection', rejection => console.error(rejection));

const Cloudant = require('@cloudant/cloudant');
const Schema = require('../lib/schema');

const args = process.argv.slice(2);

if (!args[1]) {
  throw Error('No db specified');
}

const dbUrl = args[0];
const dbNames = args.slice(1);

dbNames.forEach(async dbName => {
  const db = new Cloudant({
    url: dbUrl,
    plugins: ['promises', 'retry'],
  }).db.use(dbName);

  const clientConfig = await db.get('config');

  const schema = new Schema({
    db: {
      url: args[0],
      name: dbName,
    },
  });

  await schema.updateEntityIndex(clientConfig.schemas);

  console.log(`${dbName} --> entity index updated`);
});
