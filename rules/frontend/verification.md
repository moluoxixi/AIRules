# Frontend Verification

Cross-framework quality gates for frontend projects.

## Static Analysis

| Tool | Purpose |
|------|---------|
| ESLint | Code linting |
| TypeScript | Type checking (`tsc --noEmit`) |
| Prettier | Code formatting |

## ESLint Ecosystem

```bash
# Core linting
npm run lint

# TypeScript-aware linting
npx tsc --noEmit

# Framework-specific plugins
# - eslint-plugin-react
# - eslint-plugin-vue
# - @typescript-eslint/eslint-plugin
```

## Type Checking

```bash
# Check TypeScript without emitting files
npx tsc --noEmit

# For Vue projects
npx vue-tsc --noEmit
```

## Build Verification

```bash
# Production build
npm run build

# Check for build warnings
npm run build 2>&1 | grep -i warning
```

## Bundle Analysis

```bash
# Analyze bundle size
npm run analyze

# Check bundle budget
# Configure in vite.config.ts or next.config.js
```

## Pre-Commit Checklist

- [ ] `npm run lint` passes
- [ ] Type checking passes (`tsc --noEmit`)
- [ ] `npm run format:check` passes
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] No console errors in development

## Security Scanning

```bash
# Audit dependencies
npm audit

# Check for known vulnerabilities
npm audit --audit-level=high
```

## Performance Budgets

```javascript
// vite.config.js
export default {
  build: {
    chunkSizeWarningLimit: 500, // kB
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
};
```
