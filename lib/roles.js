const roles = {};

module.exports = roles;

// roles.super = {
//   name: 'Super',
//   permissions: {
//     entityGrid: true,
//     entityCreate: true,
//     entityRead: true,
//     entityUpdate: true,
//     entityDelete: true,
//     taxonomyCreate: true,
//     taxonomyRead: true,
//     taxonomyUpdate: true,
//     taxonomyDelete: true,
//     fileCreate: true,
//     fileRead: true,
//     fileUpdate: true,
//     fileDelete: true,
//     admin: true,
//     user: true,
//     settings: true,
//     tools: true,
//     ecommerce: true,
//   },
// };

roles.admin = {
  name: 'Admin',
  permissions: {
    entityGrid: true,
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
    admin: true,
    user: true,
    settings: true,
    tools: true,
    ecommerce: true,
  },
};

roles.editor = {
  name: 'Editor',
  permissions: {
    entityGrid: true,
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
    admin: false,
    user: false,
    settings: false,
    tools: false,
    ecommerce: false,
  },
};

roles.guest = {
  name: 'Guest',
  permissions: {
    entityGrid: true,
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
    admin: false,
    user: false,
    settings: false,
    tools: false,
    ecommerce: false,
  },
};
