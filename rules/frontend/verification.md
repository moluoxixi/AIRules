# Frontend Verification

Cross-framework quality gates for frontend projects.

## Static Analysis

| Tool | Purpose |
|------|---------|
| ESLint | Code linting and formatting (unified) |
| TypeScript | Type checking (`tsc --noEmit`) |

> **Note:** Formatting is handled by the ESLint configuration package. No separate Prettier setup is required.

## ESLint Ecosystem

We recommend using a modern ESLint flat config package that provides both linting and formatting capabilities.

### Recommended Configuration

**Primary:** `@moluoxixi/eslint-config`

```javascript
// eslint.config.mjs
import eslintConfig from '@moluoxixi/eslint-config'

export default eslintConfig({
  ignores: [
    // Files to ignore (e.g., 'dist/**', 'node_modules/**')
  ],
  rules: {
    // Custom rules
  },
})
```

**Alternative:** `@antfu/eslint-config`

```javascript
// eslint.config.mjs
import antfu from '@antfu/eslint-config'

export default antfu({
  // Configuration options
})
```

### Commands

```bash
# Core linting (includes format checking)
npm run lint

# Fix linting and formatting issues
npm run lint:fix

# TypeScript-aware linting
npx tsc --noEmit
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

- [ ] `npm run lint` passes (includes format checking)
- [ ] Type checking passes (`tsc --noEmit`)
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
