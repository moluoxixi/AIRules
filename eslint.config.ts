import eslintConfig from '@antfu/eslint-config'

export default eslintConfig({
  ignores: [
    // ai agents
    '.codex',
    '.claude',
    '.agents',
    '.trellis',
    // ideas
    '.zed',
    // project
    'public',
    '.codegraph',
    'roles/**/.sync/**',
    'roles/**/packages/**',
    'roles/requirement-flow/skills/requirement-flow/reader/assets/vendor/**',
    // Preserve machine-written receipt bytes; evidence.py validates their structure and digests.
    'roles/requirement-flow/verification/*-check.json',
    'roles/requirement-flow/verification/*-check-*.json',
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
