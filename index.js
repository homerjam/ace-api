function Api() { }

Api.Admin = require('./lib/admin');
Api.Analytics = require('./lib/analytics');
Api.Assist = require('./lib/assist');
Api.Auth = require('./lib/auth');
Api.ClientConfig = require('./lib/clientConfig');
Api.Ecommerce = require('./lib/ecommerce');
Api.Email = require('./lib/email');
Api.Embedly = require('./lib/embedly');
Api.Entity = require('./lib/entity');
Api.File = require('./lib/file');
Api.Flow = require('./lib/flow');
Api.Helpers = require('./lib/helpers');
Api.Instagram = require('./lib/instagram');
Api.Jwt = require('./lib/jwt');
Api.Pdf = require('./lib/pdf');
Api.Settings = require('./lib/settings');
Api.Shippo = require('./lib/shippo');
Api.Stripe = require('./lib/stripe');
Api.S3 = require('./lib/s3');
Api.Taxonomy = require('./lib/taxonomy');
Api.Tools = require('./lib/tools');
Api.Transcode = require('./lib/transcode');
Api.Zencode = require('./lib/zencode');

module.exports = Api;
