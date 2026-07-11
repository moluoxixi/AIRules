import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '.tmp/**',
      '.skill-references/**',
      'vendor/**',
      '.cache-git/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'constants/**/*.ts',
        'scripts/lib/**/*.ts',
      ],
      exclude: [
        '**/__test__/**',
        'vitest.config.ts',
        'eslint.config.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
