module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        "useBuiltIns": "entry",
        "corejs": "3.22"
      }
    ]
  ],
  plugins: [
    ["@babel/plugin-transform-modules-commonjs", { "strictMode": false }]
  ],
  ignore: ["node_modules"]
};
