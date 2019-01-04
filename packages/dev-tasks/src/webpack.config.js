const webpack = require('webpack');
const path = require('path');
const chalk = require('chalk');
const merge = require('webpack-merge');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const { argv } = require('yargs');
const packageName = argv.package;

const packagePath = path.join(__dirname, '../../benchmarks', packageName);

const sourcePath = path.join(packagePath, './client');
const staticsPath = path.join(packagePath, './static');

let packageWebpackConfig = undefined;
try {
  packageWebpackConfig = require(path.join(packagePath, './webpack.config.js'));
  console.log('found custom webpack config for package');
  if (typeof packageWebpackConfig !== 'function') {
    console.error('custom webpack config for package must exports a function!');
    process.exit(1);
  }
} catch (e) {}

const isProd = process.NODE_ENV === 'production';
console.log(
  `webpack build with env ${
    isProd ? chalk.green('production') : chalk.green('development')
  }`
);

const plugins = [
  new webpack.EnvironmentPlugin({
    NODE_ENV: process.NODE_ENV,
  }),
  new webpack.NamedModulesPlugin(),
  new HtmlWebpackPlugin({
    title: packageName,
    template: path.resolve(__dirname, '../template/index.html'),
  }),
];

if (isProd) {
  plugins.push(
    new webpack.LoaderOptionsPlugin({
      minimize: true,
      debug: false,
    }),
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: !isProd ? '[name].css' : '[name].[hash].css',
      chunkFilename: !isProd ? '[id].css' : '[id].[hash].css',
    })
  );
} else {
  plugins.push(new webpack.HotModuleReplacementPlugin());
}

const ruleJs = /\.(js|jsx)$/;
const isRuleJs = test => test.source === ruleJs.source;

const ruleCss = /\.css$/;
const isRuleCss = test => test.source === ruleCss.source;

let config = {
  devtool: isProd ? 'source-map' : 'eval',
  context: sourcePath,
  entry: {
    js: './index.js',
    vendor: ['react', 'react-dom', 'benchmarks-utils'],
  },
  output: {
    path: staticsPath,
    filename: '[name].bundle.js',
  },
  optimization: !isProd
    ? undefined
    : {
        splitChunks: {
          // include all types of chunks
          chunks: 'all',
        },
        minimizer: [
          new UglifyJsPlugin({
            uglifyOptions: {
              warnings: false,
              screw_ie8: true,
              conditionals: true,
              unused: true,
              comparisons: true,
              sequences: true,
              dead_code: true,
              evaluate: true,
              if_return: true,
              join_vars: true,
            },
          }),
        ],
      },
  module: {
    rules: [
      {
        test: ruleJs,
        include: sourcePath,
        exclude: /node_modules/,
        use: ['babel-loader'],
      },
      {
        test: ruleCss,
        exclude: /node_modules/,
        use: [
          !isProd ? 'style-loader' : MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: { sourceMap: true },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: [
      '.webpack-loader.js',
      '.web-loader.js',
      '.loader.js',
      '.js',
      '.jsx',
    ],
    modules: [
      // path.join(__dirname, '..', '..', packageName, 'node_modules')
      // 'node_modules',
      path.join(
        __dirname,
        '..',
        '..',
        'benchmarks',
        packageName,
        'node_modules'
      ),
      path.join(__dirname, '..', '..', '..', 'node_modules'),
    ],
  },

  plugins,

  performance: isProd && {
    maxAssetSize: 100,
    maxEntrypointSize: 300,
    hints: 'warning',
  },

  stats: {
    colors: {
      green: '\u001b[32m',
    },
  },

  devServer: {
    contentBase: './client',
    historyApiFallback: true,
    port: 3000,
    compress: isProd,
    inline: !isProd,
    hot: !isProd,
    watchContentBase: true,
    stats: {
      assets: true,
      children: false,
      chunks: false,
      hash: false,
      modules: false,
      publicPath: false,
      timings: true,
      version: false,
      warnings: true,
      colors: {
        green: '\u001b[32m',
      },
    },
  },
};

if (packageWebpackConfig) {
  packageWebpackConfig({ config, merge, isProd, isRuleCss, isRuleJs }).module
    .rules;
}

module.exports = config;
