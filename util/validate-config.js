const fs = require('fs');
const ConfigValidator = require('./config-validator');

const slug = process.argv.slice(3)[0];

const config = JSON.parse(fs.readFileSync('config/' + slug + '.json'));

const v = new ConfigValidator();

v.validate(config, { throwError: true });

console.log(slug, 'config valid');
