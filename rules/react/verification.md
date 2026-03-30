# React Verification

Quality gates for React / Next.js projects.

## Static Analysis Tools

| Tool | Purpose | Command |
|------|---------|---------|
| ESLint | Code linting | `npm run lint` |
| typescript-eslint | TypeScript-aware linting | Included in ESLint |
| Prettier | Code formatting | `npm run format` |
| TypeScript | Type checking | `npx tsc --noEmit` |

## ESLint Configuration

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended"
  ],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/explicit-function-return-type": "off"
  }
}
```

## Verification Commands

```bash
# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Formatting check
npm run format:check

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
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run format:check` passes
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
