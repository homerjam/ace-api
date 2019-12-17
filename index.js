function Api() {}

Api.defaultConfig = require('./config.default');

Api.Assist = (...args) => new (require('./lib/assist'))(...args);
Api.Auth = (...args) => new (require('./lib/auth'))(...args);
Api.ClientConfig = (...args) => new (require('./lib/client-config'))(...args);
Api.Db = (...args) => new (require('./lib/db'))(...args);
Api.Email = (...args) => new (require('./lib/email'))(...args);
Api.Embedly = (...args) => new (require('./lib/embedly'))(...args);
Api.Entity = (...args) => new (require('./lib/entity'))(...args);
Api.Fields = (...args) => new (require('./lib/fields'))(...args);
Api.Helpers = (...args) => new (require('./lib/helpers'))(...args);
Api.Instagram = (...args) => new (require('./lib/instagram'))(...args);
Api.Jwt = (...args) => new (require('./lib/jwt'))(...args);
Api.Pdf = (...args) => new (require('./lib/pdf'))(...args);
Api.Roles = (...args) => new (require('./lib/roles'))(...args);
Api.Schema = (...args) => new (require('./lib/schema'))(...args);
Api.Settings = (...args) => new (require('./lib/settings'))(...args);
Api.Shopify = (...args) => new (require('./lib/shopify'))(...args);
Api.Taxonomy = (...args) => new (require('./lib/taxonomy'))(...args);
Api.Tools = (...args) => new (require('./lib/tools'))(...args);
Api.User = (...args) => new (require('./lib/user'))(...args);

module.exports = Api;
