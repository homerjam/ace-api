const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = [
  {
    devtool: 'source-map',
    entry: './index.js',
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
      library: 'AceApi',
      libraryTarget: 'umd',
      path: path.join(__dirname, 'dist'),
      filename: 'api.js',
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
      library: 'AceApiServer',
      libraryTarget: 'umd',
      path: path.join(__dirname, 'dist'),
      filename: 'server.js',
    },
  },
];
