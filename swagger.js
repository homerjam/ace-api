const http = require('http');
const app = require('connect')();
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerTools = require('swagger-tools');
const opn = require('opn');

const serverPort = 3000;

// swaggerRouter configuration
const routerOptions = {
  controllers: './controllers',
  useStubs: process.env.NODE_ENV === 'development', // Conditionally turn on stubs (mock mode)
};

// The Swagger spec (require it, build it programmatically, fetch it from a URL, ...)
// const swaggerSpec = require('./api/swagger.json');

const jsDocOptions = {
  swaggerDefinition: {
    info: {
      title: 'ACE API', // Title (required)
      version: '0.0.0', // Version (required)
    },
    host: 'localhost:5000',
    basePath: '/api/latest',
  },
  apis: ['./routes/*.js'], // Path to the API docs
};

// Initialize swagger-jsdoc -> returns validated swagger spec in json format
const swaggerSpec = swaggerJSDoc(jsDocOptions);

// Initialize the Swagger middleware
swaggerTools.initializeMiddleware(swaggerSpec, (middleware) => {
  // Interpret Swagger resources and attach metadata to request - must be first in swagger-tools middleware chain
  app.use(middleware.swaggerMetadata());

  // Validate Swagger requests
  app.use(middleware.swaggerValidator());

  // Route validated requests to appropriate controller
  // app.use(middleware.swaggerRouter(routerOptions));

  // Serve the Swagger documents and Swagger UI
  app.use(middleware.swaggerUi());

  // Start the server
  http.createServer(app).listen(serverPort, () => {
    console.log('Your server is listening on port %d (http://localhost:%d)', serverPort, serverPort);

    opn(`http://localhost:${serverPort}/docs`);
  });
});
