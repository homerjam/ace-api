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
      // admin: true,
      schema: false,
      user: true,
      settings: true,
      tools: true,
      ecommerce: true,
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
      // admin: false,
      schema: false,
      user: false,
      settings: false,
      tools: false,
      ecommerce: false,
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
      // admin: false,
      schema: false,
      user: false,
      settings: false,
      tools: false,
      ecommerce: false,
    },
  },
];

class Roles {
  static roles() {
    return roles.map(role => Object.freeze(role));
  }
  static role(slug) {
    return _.find(Roles.roles(), { slug });
  }
}

module.exports = Roles;
