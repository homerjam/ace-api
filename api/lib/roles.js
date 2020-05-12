const _ = require('lodash');

const roles = [
  {
    name: 'Admin',
    slug: 'admin',
    permissions: {
      entityCreate: true,
      entityRead: true,
      entityUpdate: true,
      entityDelete: true,

      taxonomyCreate: true,
      taxonomyRead: true,
      taxonomyUpdate: true,
      taxonomyDelete: true,

      fileCreate: true,
      fileRead: true,
      fileUpdate: true,
      fileDelete: true,

      settingsCreate: true,
      settingsRead: true,
      settingsUpdate: true,
      settingsDelete: true,

      config: false,
      schema: false,
      user: true,
      userSettings: true,
      tools: true,
    },
  },
  {
    name: 'Editor',
    slug: 'editor',
    permissions: {
      entityCreate: true,
      entityRead: true,
      entityUpdate: true,
      entityDelete: true,

      taxonomyCreate: true,
      taxonomyRead: true,
      taxonomyUpdate: true,
      taxonomyDelete: true,

      fileCreate: true,
      fileRead: true,
      fileUpdate: true,
      fileDelete: true,

      settingsCreate: true,
      settingsRead: true,
      settingsUpdate: true,
      settingsDelete: true,

      config: false,
      schema: false,
      user: false,
      userSettings: true,
      tools: false,
    },
  },
  {
    name: 'Guest',
    slug: 'guest',
    permissions: {
      entityCreate: false,
      entityRead: true,
      entityUpdate: false,
      entityDelete: false,

      taxonomyCreate: false,
      taxonomyRead: true,
      taxonomyUpdate: false,
      taxonomyDelete: false,

      fileCreate: false,
      fileRead: true,
      fileUpdate: false,
      fileDelete: false,

      settingsCreate: false,
      settingsRead: false,
      settingsUpdate: false,
      settingsDelete: false,

      config: false,
      schema: false,
      user: false,
      userSettings: false,
      tools: false,
    },
  },
];

class Roles {
  roles() {
    return roles.map((role) => Object.freeze(role));
  }
  role(slug) {
    return _.find(this.roles(), { slug });
  }
}

module.exports = Roles;
