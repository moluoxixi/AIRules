import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '.skill-references/**',
      'vendor/**',
      '.cache-git/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'constants/**/*.ts',
        'roles/*/runtime/**/*.ts',
        'scripts/lib/**/*.ts',
      ],
      exclude: [
        '**/__test__/**',
        // This entrypoint executes in a supervised child process, outside the parent V8 coverage isolate.
        '**/host-process-worker.ts',
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
