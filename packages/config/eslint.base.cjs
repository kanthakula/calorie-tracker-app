// Shared ESLint base config (flat-config compatible via "extends" consumers).
// Kept dependency-light so every workspace can opt in without heavy plugins.
module.exports = {
  root: false,
  env: { es2022: true, node: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  extends: ['eslint:recommended'],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': 'off',
    'prefer-const': 'warn',
    eqeqeq: ['warn', 'smart'],
  },
  ignorePatterns: ['dist/', '.next/', 'build/', 'node_modules/'],
};
