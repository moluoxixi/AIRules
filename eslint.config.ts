import eslintConfig from '@antfu/eslint-config'

export default eslintConfig({
  ignores: [
    'scripts',
    'public',
    '.zed',
    'docs',
  ],
  rules: {
    // user
    'unused-imports/no-unused-vars': 'off',
    'node/prefer-global/process': 'off',
    'no-unused-vars': 'off',
    'no-console': 'off',
    'regexp/no-unused-capturing-group': 'off',
  },
})
