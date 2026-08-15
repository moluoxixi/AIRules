import eslintConfig from '@antfu/eslint-config'

export default eslintConfig({
  ignores: [
    'public',
    '.zed',
    '.cache-git',
    'coverage',
    'docs',
    'dist',
    'roles/moluoxixi/skills/init-project/assets/hosts/**',
    'roles/moluoxixi/skills/init-project/assets/project/**/*.yaml',
    'roles/moluoxixi/packages/**',
    'roles/moluoxixi/skills/init-project/assets/runtime/vendor/**',
    'roles/moluoxixi/skills/**/*.md',
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
