const _ = require('lodash');
const Stripe = require('stripe');
const Promise = require('bluebird');
const Hashids = require('hashids');

const ClientConfig = require('./client-config');
const Email = require('./email');
const Db = require('./db');
const Helpers = require('./helpers');

class StripeClass {
  constructor(config) {
    this.config = config;

    this.stripe = Stripe(this.config.stripe.apiKey);
    this.email = new Email(this.config);

    this.hashids = new Hashids(this.config.slug, 6, '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  }

  async getSettings() {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    let settings;

    try {
      settings = clientConfig.module.ecommerce;
    } catch (error) {
      throw new Error(error);
    }

    try {
      settings.clientStripeAccountId = clientConfig.provider.stripe.stripe_user_id;
    } catch (error) {
      throw new Error(error);
    }

    settings.client = clientConfig.client;
    settings.assets = clientConfig.assets;

    return settings;
  }

  checkout(token, order) {
    return new Promise((resolve, reject) => {
      this.getSettings()
        .then((settings) => {

          const listId = _.get(settings, 'createsend.checkoutSubscriberListId');

          if (order.subscribe && listId) {
            this.email.subscribe(order.customerDetails, 'createsend', listId)
              .then((result) => {
                console.log(result);
              }, (error) => {
                console.error(error);
              });
          }

          // lookup customer by email, create if not found
          this.findOrCreateCustomer(order.customerDetails.email, order)
            .then((customer) => {

              // store order data (customer, items, address)
              this.createOrder(order, customer)
                .then((order) => {

                  this.updateOrCreateStripeCustomer(settings.clientStripeAccountId, customer, token, order)
                    .then((stripeCustomer) => {

                      // update customer, append order to customer, update metadata
                      this.updateCustomer(customer, stripeCustomer, order)
                        .then((customer) => {

                          // create charge, take fee
                          this.createCharge(settings, stripeCustomer, customer, order)
                            .then((updatedOrder) => {

                              this.sendReceipt(settings, customer, order)
                                .then((orderReceipt) => {

                                  updatedOrder.messages.orderReceipt = orderReceipt;

                                  this.sendNotification(settings, customer, order)
                                    .then((orderNotification) => {

                                      updatedOrder.messages.orderNotification = orderNotification;

                                      // update order charge status, charge id
                                      this.updateOrder(updatedOrder)
                                        .then((finalOrder) => {

                                          resolve(finalOrder);

                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        })
        .catch(reject);
    });
  }

  retrieveAccount() {
    return new Promise((resolve, reject) => {
      this.getSettings()
        .then((settings) => {
          this.stripe.accounts.retrieve(settings.clientStripeAccountId)
            .then(resolve, reject);
        }, reject);
    });
  }

  refund(order, amount) {
    return new Promise((resolve, reject) => {
      this.getSettings()
        .then((settings) => {
          this.stripe.refunds.create({
            refund_application_fee: true,
            charge: order.charge.id,
            amount,
          }, {
            stripe_account: settings.clientStripeAccountId,
          })
            .then((refund) => {
              this.stripe.charges.retrieve(order.charge.id, {
                stripe_account: settings.clientStripeAccountId,
              })
                .then((charge) => {
                  order.charge.status = charge.status;
                  order.charge.amount = charge.amount;
                  order.charge.amountRefunded = charge.amount_refunded;

                  Helpers.createOrUpdate(this.config, order)
                    .then(resolve, reject);
                }, reject);
            }, reject);
        }, reject);
    });
  }

  findOrCreateCustomer(email, order) {
    return new Promise((resolve, reject) => {
      Db.connect(this.config).viewAsync('ecommerce', 'customerByEmail', {
        keys: [email],
        include_docs: true,
      })
        .then((body) => {
          if (body.rows.length) {
            resolve(body.rows[0].doc);

          } else {
            const now = JSON.stringify(new Date()).replace(/"/g, '');

            const newCustomer = {
              type: 'customer',
              createdAt: now,
              modifiedAt: now,
              email: order.customerDetails.email,
              name: order.customerDetails.name,
              phone: order.customerDetails.phone,
              billingAddress: order.billingAddress,
              shippingAddress: order.shippingAddress,
              orders: [],
            };

            Db.connect(this.config).insertAsync(newCustomer)
              .then((body) => {
                newCustomer._id = body.id;
                newCustomer._rev = body.rev;

                resolve(newCustomer);
              }, reject);
          }
        }, reject);
    });
  }

  updateOrCreateStripeCustomer(clientStripeAccountId, customer, token, order) {
    return new Promise((resolve, reject) => {
      const stripeCustomer = {
        source: token,
        email: order.customer.email,
        description: order.customer.name,
        metadata: {
          customer_id: customer._id,
        // billingAddress: JSON.stringify(order.billingAddress),
        // shippingAddress: JSON.stringify(order.shippingAddress)
        },
      };

      if (customer.stripe && customer.stripe.customer.id) {
        this.stripe.customers.update(customer.stripe.customer.id, stripeCustomer, {
          stripe_account: clientStripeAccountId,
        })
          .then(resolve, (error) => {
            if (error.type === 'StripeInvalidRequestError' && error.param === 'id') {
              this.stripe.customers.create(stripeCustomer, {
                stripe_account: clientStripeAccountId,
              }).then(resolve, reject);

            } else {
              reject(error);
            }
          });

      } else {
        this.stripe.customers.create(stripeCustomer, {
          stripe_account: clientStripeAccountId,
        }).then(resolve, reject);
      }
    });
  }

  createOrder(order, customer) {
    return new Promise((resolve, reject) => {
      const items = order.items.map(item => ({
        id: item.id,
        title: item.title.replace(/<br\s?>/ig, ' ').replace(/<\/?p>|<\/?span>/ig, ''),
        price: item.price,
        quantity: item.quantity,
        metadata: item.metadata || {},
      }));

      const now = JSON.stringify(new Date()).replace(/"/g, '');

      const newOrder = {
        type: 'order',
        orderId: this.hashids.encode(new Date().getTime()),
        createdAt: now,
        modifiedAt: now,
        customer: {
          id: customer._id,
          email: customer.email,
          name: customer.name,
        },
        items,
        shippingMethod: {
          name: order.shippingMethod.name,
          amount: Number(order.shippingMethod.amount),
        },
        subtotal: Number(order.subtotal),
        tax: {
          rate: order.tax.rate || 0,
          includedInPrice: order.tax.includedInPrice || false,
          total: order.tax.total || 0,
          show: order.tax.show || false,
        },
        discount: {
          code: order.discount.code || '',
          name: order.discount.name || '',
          total: order.discount.total || 0,
        },
        total: Number(order.total),
        billingAddress: order.billingAddress,
        shippingAddress: order.shippingAddress,
        messages: {},
        status: 'pending',
        test: true,
      };

      Db.connect(this.config).insertAsync(newOrder)
        .then((body) => {
          newOrder._id = body.id;
          newOrder._rev = body.rev;

          resolve(newOrder);
        }, reject);
    });
  }

  updateOrder(order) {
    return new Promise((resolve, reject) => {
      Db.connect(this.config).insertAsync(order)
        .then((body) => {
          order._rev = body.rev;

          resolve(order);
        }, reject);
    });
  }

  updateCustomer(customer, stripeCustomer, order) {
    return new Promise((resolve, reject) => {
      const now = JSON.stringify(new Date()).replace(/"/g, '');

      customer.modifiedAt = now;

      if (!customer.orders) {
        customer.orders = [];
      }

      customer.orders.push(order._id);

      if (!customer.stripe) {
        customer.stripe = {
          customer: {
            id: null,
          },
        };
      }

      customer.stripe.customer.id = stripeCustomer.id;

      Db.connect(this.config).insertAsync(customer)
        .then((body) => {
          customer._rev = body.rev;

          resolve(customer);
        }, reject);
    });
  }

  createCharge(settings, stripeCustomer, customer, order) {
    return new Promise((resolve, reject) => {
      const amount = Number(order.total) * 100;

      const charge = {
        amount,
        currency: settings.currency.iso.toLowerCase(),
        customer: stripeCustomer.id,
        capture: true,
        description: order.orderId,
        // shipping: order.shippingAddress, // fraud prevention, must follow expected schema
        metadata: {
          customer_id: customer._id,
          order_id: order._id,
        },
        statement_descriptor: _.kebabCase(settings.storeName).toUpperCase(),
        application_fee: Math.ceil(amount * 0.02),
      };

      this.stripe.charges.create(charge, {
        stripe_account: settings.clientStripeAccountId,
      })
        .then((charge) => {

          order.charge = {
            paymentGateway: 'stripe',
            id: charge.id,
            status: charge.status,
            currency: charge.currency.toUpperCase(),
            amount: charge.amount,
            amountRefunded: charge.amount_refunded,
          };

          order.test = !charge.livemode;

          resolve(order);

        }, reject);
    });
  }

  sendReceipt(settings, customer, order) {
    return new Promise((resolve, reject) => {
      const templateData = {
        settings,
        order,
      };

      const emailOptions = {
        from: `${settings.emailSenderName} <${settings.emailSenderAddress}>`,
        to: customer.email,
        subject: `Your order at ${settings.storeName} (${order.orderId})`,
      };

      const assetSlug = _.get(settings, 'assets.slug', this.config.slug);

      this.email.sendEmail(emailOptions, `${assetSlug}/order-receipt`, templateData).then(resolve, reject);
    });
  }

  sendNotification(settings, customer, order) {
    return new Promise((resolve, reject) => {
      const templateData = {
        settings,
        order,
      };

      const emailOptions = {
        from: `${settings.emailSenderName} <${settings.emailSenderAddress}>`,
        to: settings.emailSenderAddress,
        subject: `New order at ${settings.storeName} (${order.orderId})`,
      };

      const assetSlug = _.get(settings, 'assets.slug', this.config.slug);

      this.email.sendEmail(emailOptions, `${assetSlug}/order-notification`, templateData).then(resolve, reject);
    });
  }

}

module.exports = StripeClass;
