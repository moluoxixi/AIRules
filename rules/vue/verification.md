# Vue Verification

Quality gates for Vue 3 / Vite projects.

## Static Analysis Tools

| Tool | Purpose | Command |
|------|---------|---------|
| ESLint | Code linting | `npm run lint` |
| eslint-plugin-vue | Vue-specific linting | Included in ESLint |
| vue-tsc | Vue SFC type checking | `vue-tsc --noEmit` |
| Prettier | Code formatting | `npm run format` |

## ESLint Configuration

```javascript
// eslint.config.js
import pluginVue from 'eslint-plugin-vue';
import ts from 'typescript-eslint';

export default [
  ...ts.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['*.vue', '**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
    },
  },
];
```

## Verification Commands

```bash
# Type checking for Vue SFCs
npx vue-tsc --noEmit

# Linting
npm run lint

# Formatting check
npm run format:check

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
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run format:check` passes
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] No console warnings in development

## Vue DevTools

Enable Vue DevTools in development to catch:
- Reactivity warnings
- Component tree inspection
- Event tracking
- Performance profiling
