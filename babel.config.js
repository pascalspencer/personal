export const presets = [
  [
    "@babel/preset-env",
    {
      "useBuiltIns": "entry",
      "corejs": "3.22"
    }
  ]
];
export const plugins = [
  ["@babel/plugin-transform-modules-commonjs", { "strictMode": false }]
];
export const ignore = ["node_modules"];
