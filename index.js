function Api() { }

Api.Analytics = require('./lib/analytics');
Api.Assist = require('./lib/assist');
Api.Auth = require('./lib/auth');
Api.ClientConfig = require('./lib/client-config');
Api.Db = require('./lib/db');
Api.Ecommerce = require('./lib/ecommerce');
Api.Email = require('./lib/email');
Api.Embedly = require('./lib/embedly');
Api.Entity = require('./lib/entity');
Api.Fields = require('./lib/fields');
Api.File = require('./lib/file');
Api.Flow = require('./lib/flow');
Api.Helpers = require('./lib/helpers');
Api.Instagram = require('./lib/instagram');
Api.Jwt = require('./lib/jwt');
Api.Pdf = require('./lib/pdf');
Api.Roles = require('./lib/roles');
Api.S3 = require('./lib/s3');
Api.Schema = require('./lib/schema');
Api.Shippo = require('./lib/shippo');
Api.Stripe = require('./lib/stripe');
Api.Taxonomy = require('./lib/taxonomy');
Api.Tools = require('./lib/tools');
// Api.Transcode = require('./lib/transcode');
Api.User = require('./lib/user');
Api.Zencode = require('./lib/zencode');

module.exports = Api;
