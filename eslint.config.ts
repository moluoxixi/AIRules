import eslintConfig from '@antfu/eslint-config'

export default eslintConfig({
  ignores: [
    'public',
    '.zed',
    '.cache-git',
    'coverage',
    'docs',
    'dist',
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
}, {
  files: ['**/agents/openai.yaml'],
  rules: {
    // Codex skill metadata requires these interface strings to remain quoted.
    'yaml/plain-scalar': 'off',
  },
})
