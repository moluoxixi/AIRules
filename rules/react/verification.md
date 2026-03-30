# React Verification

Quality gates for React / Next.js projects.

## Static Analysis Tools

| Tool | Purpose | Command |
|------|---------|---------|
| ESLint | Code linting and formatting (unified) | `npm run lint` |
| TypeScript | Type checking | `npx tsc --noEmit` |

> **Note:** Formatting is handled by the ESLint configuration package. No separate Prettier setup is required.

## ESLint Configuration

We recommend using a modern ESLint flat config package with built-in React/JSX support.

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

Both packages include built-in support for React, JSX, TypeScript, and formatting.

## Verification Commands

```bash
# Type checking
npx tsc --noEmit

# Linting (includes format checking)
npm run lint

# Fix linting and formatting issues
npm run lint:fix

# Build verification
npm run build

# Full pipeline
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

## Next.js Specific

```bash
# Static export check
next build

# Check for build errors
next lint
```

## Pre-Commit Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes with zero errors (includes format checking)
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] No console errors in development

## Bundle Analysis

```bash
# Analyze bundle size
npm run analyze

# Check for duplicate dependencies
npx duplicate-package-checker
```
