const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = ({ config, isProd, isRuleCss, isRuleJs }) => {
  config.module.rules = config.module.rules.map(rule => {
    if (isRuleJs(rule.test)) {
      return {
        test: rule.test,
        include: rule.include,
        exclude: rule.exclude,
        use: [
          { loader: 'babel-loader' },
          {
            loader: 'linaria/loader',
            options: {
              sourceMap: !isProd,
            },
          },
        ],
      };
    }
    return rule;
  });

  return config;
};
