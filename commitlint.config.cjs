module.exports = {
  extends: ['@commitlint/config-conventional'],
  defaultIgnores: true,
  ignores: [
    message => message.startsWith('fixup! '),
    message => message.startsWith('squash! '),
  ],
  rules: {
    'type-enum': [2, 'always', [
      'feat',
      'fix',
      'docs',
      'style',
      'refactor',
      'perf',
      'test',
      'build',
      'ci',
      'chore',
    ]],
    'scope-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-max-length': [2, 'always', 50],
    'body-max-line-length': [2, 'always', 272],
  },
}
