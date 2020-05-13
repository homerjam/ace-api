const _ = require('lodash');

class Roles {
  static all() {
    return Roles.roles;
  }

  static find(slug) {
    return _.find(Roles.roles, { slug });
  }

  static roles = [
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

        usersCreate: true,
        usersRead: true,
        usersUpdate: true,
        usersDelete: true,

        config: false,
        schema: false,
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

        settingsCreate: false,
        settingsRead: true,
        settingsUpdate: false,
        settingsDelete: false,

        usersCreate: false,
        usersRead: true,
        usersUpdate: false,
        usersDelete: false,

        config: false,
        schema: false,
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

        usersCreate: false,
        usersRead: false,
        usersUpdate: false,
        usersDelete: false,

        config: false,
        schema: false,
        tools: false,
      },
    },
  ].map((role) => Object.freeze(role));
}

module.exports = Roles;
