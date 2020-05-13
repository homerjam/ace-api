const _ = require('lodash');

class Roles {
  static ADMIN = 'guest';
  static EDITOR = 'guest';
  static GUEST = 'guest';

  static roles = [
    {
      slug: Roles.ADMIN,
      name: 'Admin',
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
      slug: Roles.EDITOR,
      name: 'Editor',
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
      slug: Roles.GUEST,
      name: 'Guest',
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

  static all() {
    return Roles.roles;
  }

  static find(slug) {
    return _.find(Roles.roles, { slug });
  }
}

module.exports = Roles;
