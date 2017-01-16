const _ = require('lodash');
const Promise = require('bluebird');
const Helpers = require('./helpers');

class Ecommerce {
  constructor(db, config) {
    this.db = db;
    this.config = config;
  }

  settings(settings) {
    return new Promise((resolve, reject) => {
      if (settings) {
        settings._id = 'ecommerce.settings';

        Helpers.createOrUpdate(this.db, settings)
          .then(resolve, reject);

        return;
      }

      this.db().getAsync('ecommerce.settings').then(resolve, resolve.bind(null, {}));
    });
  }

  getType(type, query) {
    return new Promise((resolve, reject) => {
      query.sort = _.isString(query.sort) ? '"' + query.sort + '"' : query.sort;

      this.db().searchAsync('ecommerce', type, query)
        .then(resolve, reject);
    });
  }

  setType(type, item) {
    return new Promise((resolve, reject) => {
      item.type = type;

      Helpers.createOrUpdate(this.db, item)
        .then(resolve, reject);
    });
  }

  deleteType(items) {
    return new Promise((resolve, reject) => {
      items = items.map((item) => {
        return {
          _id: item._id,
          _rev: item._rev,
          _deleted: true,
        };
      });

      Helpers.chunkUpdate(this.db, items, 1000)
        .then(resolve, reject);
    });
  }

  getOrder(orderId) {
    return new Promise((resolve, reject) => {
      this.db().viewAsync('ecommerce', 'orderById', {
        key: orderId,
        include_docs: true,
      })
        .then((body) => {
          if (!body.rows.length) {
            reject('Order not found');
            return;
          }

          resolve(body.rows[0].doc);
        }, reject);
    });
  }

  verifyDiscount(code) {
    return new Promise((resolve, reject) => {
      this.db().viewAsync('ecommerce', 'discountByCode', {
        keys: [code],
        include_docs: true,
      })
        .then((body) => {
          if (body.rows.length) {
            const discount = body.rows[0].doc;

            const now = new Date().getTime();

            const dateStart = new Date(Date.parse(discount.dateStart)).getTime();
            const dateEnd = new Date(Date.parse(discount.dateEnd)).getTime();

            if (dateStart > now) {
              reject('Discount not valid (not begun)');
              return;

            }

            if (dateEnd < now) {
              reject('Discount not valid (expired)');
              return;
            }

            resolve(discount);

          } else {
            reject({
              statusCode: 404,
              message: `Discount code not found (${code})`,
            });
          }
        }, reject);
    });
  }

}

module.exports = Ecommerce;
