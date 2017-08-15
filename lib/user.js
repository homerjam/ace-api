const _ = require('lodash');
const ClientConfig = require('./clientConfig');

class User {
  constructor(config) {
    this.config = config;

    return this;
  }

  async create(user) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    clientConfig.users.push(user);

    return cc.set(clientConfig);
  }

  async read(userId) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    const user = _.find(clientConfig.users, { id: userId });

    if (!user) {
      throw Error(`User not found: ${userId}`);
    }

    return user;
  }

  async update(user) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    const index = _.findIndex(clientConfig.users, { id: user.id });

    if (index === -1) {
      throw Error(`User not found: ${user.id}`);
    }

    clientConfig.users.splice(index, 1, user);

    return cc.set(clientConfig);
  }

  async delete(userId) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    userId = _.isArray(userId) ? userId : [userId];

    clientConfig.users = clientConfig.users.filter(user => userId.indexOf(user.id) === -1);

    return cc.set(clientConfig);
  }
}

module.exports = User;
