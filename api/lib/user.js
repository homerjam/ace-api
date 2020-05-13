const _ = require('lodash');
const Db = require('./db');
const Roles = require('./roles');
const Utils = require('./utils');

const defaultUser = {
  firstName: '',
  lastName: '',
  email: '',
  role: Roles.all()[0].slug,
  active: true,
  settings: {
    darkMode: true,
    provider: {
      google: {},
      instagram: {},
      spotify: {},
      vimeo: {},
    },
  },
};

class User {
  constructor(config) {
    this.config = config;

    return this;
  }

  async create(user) {
    user = await this.update(user);
    return user;
  }

  async read(userId) {
    let users;

    try {
      users = await Db.connect(this.config).get('users');
    } catch (error) {
      users = {
        users: {},
      };
    }

    users.users = _.mapValues(users.users, (user) =>
      _.merge({}, defaultUser, user)
    );

    if (userId) {
      if (!users.users[userId]) {
        throw Error(`User not found '${userId}'`);
      }

      return { [userId]: users.users[userId] };
    }

    return users.users;
  }

  async update(user) {
    if (!user.email) {
      throw Error(`User requires 'email'`);
    }

    user.email = user.email.toLowerCase();

    if (!user.id) {
      user.id = user.email;
    }

    let users = await this.read();

    users = await Utils.createOrUpdate(this.config, {
      users: {
        ...users,
        [user.id]: _.merge({}, users[user.id], user),
      },
      _id: 'users',
      type: 'users',
    });

    users.users = _.mapValues(users.users, (user) =>
      _.merge({}, defaultUser, user)
    );

    return { [user.id]: users.users[user.id] };
  }

  async delete(userId) {
    let users = await this.read();

    delete users[userId];

    users = await Utils.createOrUpdate(this.config, {
      users,
      _id: 'users',
      type: 'users',
    });

    return { [userId]: null };
  }
}

module.exports = User;
