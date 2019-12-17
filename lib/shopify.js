const axios = require('axios');
const he = require('he');
const Handlebars = require('handlebars');
const jsontoxml = require('jsontoxml');

const ClientConfig = require('./client-config');

class Shopify {
  constructor(config) {
    this.config = config;
  }

  async getCatalog({ shopLink, productLinkTemplate }) {
    const cc = new ClientConfig(this.config);

    const clientConfig = await cc.get();

    const result = (
      await axios({
        url: `https://${clientConfig.provider.shopify.domain}.myshopify.com/api/graphql`,
        method: 'post',
        headers: {
          'X-Shopify-Storefront-Access-Token':
            clientConfig.provider.shopify.storefrontAccessToken,
        },
        data: {
          query: `
          query {
            shop {
              name
              primaryDomain {
                url
              }
              description
              products(first: 250) {
                edges {
                  node {
                    id
                    handle
                    title
                    description
                    onlineStoreUrl
                    images(first: 1) {
                      edges {
                        node {
                          originalSrc
                          transformedSrc
                        }
                      }
                    }
                    productType
                    vendor
                    availableForSale
                    priceRange {
                      minVariantPrice {
                        amount
                        currencyCode
                      }
                      maxVariantPrice {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        },
      })
    ).data.data;

    const template = Handlebars.compile(productLinkTemplate);

    const products = result.shop.products.edges.map(edge => ({
      'g:id': edge.node.handle,
      'g:title': he.encode(edge.node.title),
      'g:description': he.encode(edge.node.description),
      // 'g:link': edge.node.onlineStoreUrl,
      'g:link': template({ handle: edge.node.handle }),
      'g:image_link': edge.node.images.edges[0].node.originalSrc,
      'g:brand': edge.node.vendor,
      'g:condition': 'new',
      'g:availability': edge.node.availableForSale
        ? 'in stock'
        : 'out of stock',
      'g:price': `${edge.node.priceRange.minVariantPrice.amount} ${edge.node.priceRange.minVariantPrice.currencyCode}`,
      // 'g:google_product_category': he.encode(edge.node.productType),
    }));

    const channel = [
      { name: 'title', text: result.shop.name },
      // { name: 'link', text: result.shop.primaryDomain.url },
      { name: 'link', text: shopLink },
      { name: 'description', text: result.shop.description },
    ];

    products.forEach(product => {
      channel.push({
        name: 'item',
        children: product,
      });
    });

    return `<?xml version="1.0"?>
    <rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
      ${jsontoxml({ channel })}
    </rss>`;
  }
}

module.exports = Shopify;
