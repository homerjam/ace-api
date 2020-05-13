function App() {}

App.defaultConfig = require('./app.config');

App.Assist = (...args) => new (require('./lib/assist'))(...args);
App.Auth = (...args) => new (require('./lib/auth'))(...args);
App.ClientConfig = (...args) => new (require('./lib/client-config'))(...args);
App.Db = (...args) => new (require('./lib/db'))(...args);
App.Email = (...args) => new (require('./lib/email'))(...args);
App.Embedly = (...args) => new (require('./lib/embedly'))(...args);
App.Entity = (...args) => new (require('./lib/entity'))(...args);
App.Fields = (...args) => new (require('./lib/fields'))(...args);
App.Helpers = (...args) => new (require('./lib/helpers'))(...args);
App.Instagram = (...args) => new (require('./lib/instagram'))(...args);
App.Jwt = (...args) => new (require('./lib/jwt'))(...args);
App.Pdf = (...args) => new (require('./lib/pdf'))(...args);
App.Provider = (...args) => new (require('./lib/provider'))(...args);
App.Roles = (...args) => new (require('./lib/roles'))(...args);
App.Schema = (...args) => new (require('./lib/schema'))(...args);
App.Settings = (...args) => new (require('./lib/settings'))(...args);
App.Shopify = (...args) => new (require('./lib/shopify'))(...args);
App.Taxonomy = (...args) => new (require('./lib/taxonomy'))(...args);
App.Tools = (...args) => new (require('./lib/tools'))(...args);
App.User = (...args) => new (require('./lib/user'))(...args);
App.Utils = (...args) => new (require('./lib/utils'))(...args);

module.exports = App;
