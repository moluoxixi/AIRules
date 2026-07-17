import eslintConfig from '@antfu/eslint-config'

export default eslintConfig({
  ignores: [
    'public',
    '.zed',
    '.cache-git',
    'coverage',
    'docs',
    'dist',
    'roles/moluoxixi/.agents/**',
    'roles/moluoxixi/.claude/**',
    'roles/moluoxixi/.codex/**',
    'roles/moluoxixi/.cursor/**',
    'roles/moluoxixi/.omp/**',
    'roles/moluoxixi/.opencode/**',
    'roles/moluoxixi/.pi/**',
    'roles/moluoxixi/skills/init-project/assets/runtime/source/**',
    'roles/moluoxixi/skills/init-project/assets/runtime/vendor/**',
    'roles/moluoxixi/skills/**/*.md',
    'roles/moluoxixi/skills/init-project/assets/moluoxixi-v0.6.7/**',
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
