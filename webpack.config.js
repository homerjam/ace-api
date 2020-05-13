const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = [
  {
    devtool: 'source-map',
    entry: './app/app.js',
    target: 'node',
    externals: [nodeExternals()],
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'babel-loader',
            },
          ],
        },
      ],
    },
    output: {
      library: 'App',
      libraryTarget: 'umd',
      path: path.join(__dirname, 'dist'),
      filename: 'app.js',
    },
  },
  {
    devtool: 'source-map',
    entry: './server/server.js',
    target: 'node',
    externals: [nodeExternals()],
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'babel-loader',
            },
          ],
        },
      ],
    },
    output: {
      library: 'AppServer',
      libraryTarget: 'umd',
      path: path.join(__dirname, 'dist'),
      filename: 'server.js',
    },
  },
];
