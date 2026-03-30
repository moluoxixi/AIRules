# NestJS Verification

Quality gates for NestJS projects.

## Static Analysis Tools

| Tool | Purpose | Command |
|------|---------|---------|
| ESLint | Code linting and formatting (unified) | `npm run lint` |
| TypeScript | Type checking | `npx tsc --noEmit` |

> **Note:** Formatting is handled by the ESLint configuration package. No separate Prettier setup is required.

## ESLint Configuration

We recommend using a modern ESLint flat config package with built-in TypeScript support.

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

Both packages include built-in support for TypeScript and formatting, suitable for NestJS projects.

## Verification Commands

```bash
# Type checking
npx tsc --noEmit

# Linting (includes format checking)
npm run lint

# Fix linting and formatting issues
npm run lint:fix

# Full verification pipeline
npm run lint && npx tsc --noEmit && npm run test
```

## Pre-Commit Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes with zero errors (includes format checking)
- [ ] `npm run test` passes
- [ ] `npm run test:e2e` passes (if applicable)

## Package.json Scripts

```json
{
  "scripts": {
    "lint": "eslint '{src,apps,libs,test}/**/*.ts'",
    "lint:fix": "eslint '{src,apps,libs,test}/**/*.ts' --fix"
  }
}
```
