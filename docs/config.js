const API_PORT = process.env.PORT || 5001;
const DOCS_PORT = process.env.DOCS_PORT || 5011;

module.exports = {
  port: DOCS_PORT,
  swaggerDefinition: {
    info: {
      title: 'ace-api', // Title (required)
      version: '0.0.0', // Version (required)
    },
    host: `localhost:${API_PORT}`,
    basePath: '/',
    schemes: ['http', 'https'],
    securityDefinitions: {
      ApiToken: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Api-Token',
      },
    },
    security: [
      {
        ApiToken: [],
      },
    ],
    responses: {
      UnauthorizedError: {
        description: 'API key is missing or invalid',
        headers: {
          WWW_Authenticate: {
            type: 'string',
          },
        },
      },
    },
  },
  apis: ['./server/routes/*.js'], // Path to the API docs
};
