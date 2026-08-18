import eslintConfig from '@antfu/eslint-config'

export default eslintConfig({
  ignores: [
    'public',
    '.zed',
    '.cache-git',
    '.sync/*/reports/**',
    '.sync/*/work/**',
    'coverage',
    'docs',
    'dist',
    'roles/**/skills/**/*.md',
    'roles/**/skills/**/assets/**',
    'roles/**/packages/**',
    'roles/**/overlays/**',
    'vendor',
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
