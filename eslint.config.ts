import eslintConfig from '@antfu/eslint-config'

export default eslintConfig({
  ignores: [
    // ai agents
    '.codex',
    '.claude',
    // ideas
    '.zed',
    // project
    'public',
    '.codegraph',
    'roles/**/.sync/**',
    'roles/**/packages/**',
    'vendor',

    // other
    '.cache-git',
    'coverage',
    'docs',
    'dist',
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
