var ddoc = {
  _id: '_design/ecommerce',
  views: {
    customerByEmail: {
      map: function(doc) {
        if (doc.type === 'customer') {
          emit(doc.email, null);
        }
      },
    },
    orderById: {
      map: function(doc) {
        if (doc.type === 'order') {
          emit(doc._id, null);
        }
      },
    },
    discountById: {
      map: function(doc) {
        if (doc.type === 'discount') {
          emit(doc._id, null);
        }
      },
    },
    discountByCode: {
      map: function(doc) {
        if (doc.type === 'discount') {
          emit(doc.code, null);
        }
      },
    },
  },
  indexes: {
    order: {
      index: function(doc) {
        if (doc.type === 'order') {
          index('orderId', doc.orderId || '', {
            store: false,
            index: 'analyzed',
          });

          index('customer.email', doc.customer.email || '', {
            store: false,
            index: 'analyzed',
          });

          index('customer.name', doc.customer.name || '', {
            store: false,
            index: 'analyzed',
          });

          index('sort.customer.email', doc.customer.email || '', {
            store: false,
            index: 'not_analyzed',
          });

          index('sort.customer.name', doc.customer.name || '', {
            store: false,
            index: 'not_analyzed',
          });

          index('sort.subtotal', doc.subtotal || 0, {
            store: false,
            index: 'not_analyzed',
          });

          index('sort.total', doc.total || 0, {
            store: false,
            index: 'not_analyzed',
          });

          index('sort.paid', (doc.paid || false) ? 1 : 0, {
            store: false,
            index: 'not_analyzed',
          });

          index('sort.created', new Date(Date.parse(doc.created || 0)).getTime(), {
            store: false,
            index: 'not_analyzed',
          });

          index('sort.modified', new Date(Date.parse(doc.modified || 0)).getTime(), {
            store: false,
            index: 'not_analyzed',
          });

          index('test', doc.test || false, {
            store: false,
            index: 'not_analyzed',
          });
        }
      },
    },
    discount: {
      index: function(doc) {
        if (doc.type === 'discount') {
          index('name', doc.name || '', {
            store: false,
            index: 'analyzed',
          });

          index('discountType', doc.discountType || '', {
            store: false,
            index: 'analyzed',
          });

          index('code', doc.code || '', {
            store: false,
            index: 'analyzed',
          });

          index('sort.name', doc.name || '', {
            store: false,
            index: 'not_analyzed',
          });

          index('sort.discountType', doc.discountType || '', {
            store: false,
            index: 'not_analyzed',
          });

          index('sort.code', doc.code || '', {
            store: false,
            index: 'not_analyzed',
          });

          index('sort.amount', doc.amount || 0, {
            store: false,
            index: 'not_analyzed',
          });

          index('sort.usageLimit', doc.usageLimit || 0, {
            store: false,
            index: 'not_analyzed',
          });

          index('sort.usageAmount', doc.usageAmount || 0, {
            store: false,
            index: 'not_analyzed',
          });

          index('sort.dateStart', new Date(Date.parse(doc.dateStart || 0)).getTime(), {
            store: false,
            index: 'not_analyzed',
          });

          index('sort.dateEnd', new Date(Date.parse(doc.dateEnd || 0)).getTime(), {
            store: false,
            index: 'not_analyzed',
          });
        }
      },
    },
  },
};

module.exports = ddoc;

