const _ = require('lodash');

const roles = [
  {
    name: 'Admin',
    slug: 'admin',
    permissions: {
      entityGrid: true,

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

      config: false,
      schema: false,
      user: true,
      settings: true,
      userSettings: true,
      tools: true,
    },
  },
  {
    name: 'Editor',
    slug: 'editor',
    permissions: {
      entityGrid: true,

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

      config: false,
      schema: false,
      user: false,
      settings: false,
      userSettings: true,
      tools: false,
    },
  },
  {
    name: 'Guest',
    slug: 'guest',
    permissions: {
      entityGrid: true,

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

      config: false,
      schema: false,
      user: false,
      settings: false,
      userSettings: false,
      tools: false,
    },
  },
];

class Roles {
  roles() {
    return roles.map(role => Object.freeze(role));
  }
  role(slug) {
    return _.find(this.roles(), { slug });
  }
}

module.exports = Roles;
