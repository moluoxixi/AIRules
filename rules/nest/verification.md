# NestJS Verification

Quality gates for NestJS projects.

## Static Analysis Tools

| Tool | Purpose | Command |
|------|---------|---------|
| ESLint | Code linting | `npm run lint` |
| Prettier | Code formatting | `npm run format` |
| TypeScript | Type checking | `npx tsc --noEmit` |

## ESLint Configuration

Use `@nestjs/eslint-config` for consistent rules:

```json
{
  "extends": ["@nestjs/eslint-config/recommended"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn"
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

# Full verification pipeline
npm run lint && npx tsc --noEmit && npm run test
```

## Pre-Commit Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run format:check` passes
- [ ] `npm run test` passes
- [ ] `npm run test:e2e` passes (if applicable)

## Package.json Scripts

```json
{
  "scripts": {
    "lint": "eslint '{src,apps,libs,test}/**/*.ts'",
    "lint:fix": "eslint '{src,apps,libs,test}/**/*.ts' --fix",
    "format": "prettier --write 'src/**/*.ts'",
    "format:check": "prettier --check 'src/**/*.ts'"
  }
}
```
