# Vue Verification

Quality gates for Vue 3 / Vite projects.

## Static Analysis Tools

| Tool | Purpose | Command |
|------|---------|---------|
| ESLint | Code linting and formatting (unified) | `npm run lint` |
| vue-tsc | Vue SFC type checking | `vue-tsc --noEmit` |

> **Note:** Formatting is handled by the ESLint configuration package. No separate Prettier setup is required.

## ESLint Configuration

We recommend using a modern ESLint flat config package with built-in Vue support.

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

Both packages include built-in support for Vue, TypeScript, and formatting.

## Verification Commands

```bash
# Type checking for Vue SFCs
npx vue-tsc --noEmit

# Linting (includes format checking)
npm run lint

# Fix linting and formatting issues
npm run lint:fix

# Build verification
npm run build

# Full pipeline
npm run lint && npx vue-tsc --noEmit && npm run test && npm run build
```

## Vite-Specific Checks

```bash
# Preview production build
npm run build && npm run preview

# Check for build warnings
npm run build 2>&1 | grep -i warning
```

## Pre-Commit Checklist

- [ ] `npx vue-tsc --noEmit` passes
- [ ] `npm run lint` passes with zero errors (includes format checking)
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] No console warnings in development

## Vue DevTools

Enable Vue DevTools in development to catch:
- Reactivity warnings
- Component tree inspection
- Event tracking
- Performance profiling
