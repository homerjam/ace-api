const _ = require('lodash');
const Db = require('./db');
const Utils = require('./utils');

class User {
  constructor(config) {
    this.config = config;
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
