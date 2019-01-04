#!/usr/bin/env node
const WebpackDevServer = require('webpack-dev-server');
const webpack = require('webpack');

const webpackConfig = require('./webpack.config.js');
const compiler = webpack(webpackConfig);

const server = new WebpackDevServer(compiler, {
  quiet: false,
  stats: 'errors-only',
});

server.listen(3000);
