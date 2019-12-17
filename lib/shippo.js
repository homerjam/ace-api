const Promise = require('bluebird');
const shippo = require('shippo');

class Shippo {
  constructor(config) {
    this.config = config;

    this.shippo = shippo(config.shippo.token);
  }

  getQuote(address, parcel) {
    return new Promise((resolve, reject) => {
      const addressFrom = {
        object_purpose: 'QUOTE',
        zip: this.config.shippo.fromZip,
        country: this.config.shippo.fromCountry,
      };

      const addressTo = {
        object_purpose: 'QUOTE',
        // 'name': address.name,
        // 'company': '',
        // 'street1': address.street1,
        // 'street2': address.street2,
        // 'city': address.city,
        // 'state': '',
        zip: address.zip,
        country: address.country,
        // 'phone': address.phone,
        // 'email': address.email,
        metadata: '',
      };

      parcel.distance_unit = 'cm';
      parcel.mass_unit = 'kg';

      this.shippo.shipment
        .create({
          object_purpose: 'QUOTE',
          address_from: addressFrom,
          address_to: addressTo,
          parcel,
        })
        .then(
          shipment => {
            const ratesReady = (shipment, attempts) => {
              if (
                (shipment.object_status === 'QUEUED' ||
                  shipment.object_status === 'WAITING') &&
                attempts < 10
              ) {
                this.shippo.shipment.retrieve(shipment.object_id).then(val => {
                  ratesReady(val, attempts + 1);
                });
              } else {
                this.shippo.shipment.rates(shipment.object_id).then(
                  rates => {
                    resolve(rates);
                  },
                  error => {
                    console.error(
                      'There was an error retrieving rates : %s',
                      error
                    );
                    reject(error);
                  }
                );
              }
            };

            ratesReady(shipment, 0);
          },
          error => {
            console.error('There was an error creating shipment: %s', error);
            reject(error);
          }
        );
    });
  }
}

module.exports = Shippo;
