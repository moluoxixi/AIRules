---
name: vue-patterns
description: Use when building or refactoring Vue 3, Vite, Pinia, or Vue Router applications, including page composition, composables, state boundaries, forms, async data handling, and component structure.
---

# Vue Patterns

## Focus

- Prefer Composition API for shared logic
- Keep route-level orchestration in pages
- Put reusable logic in composables
- Keep Pinia stores focused on shared state, not page-local UI state
- Follow `rules/frontend/jsdoc.md` for exported components, composables, and complex utilities

## Workflow

1. Identify the page boundary, route params, and data-loading path.
2. Separate UI-only state from shared state before adding a store.
3. Model forms, loading, empty, and error states explicitly.
4. Keep components presentational when possible.

## Review Checklist

- Does this logic belong in a composable instead of a component?
- Is Pinia really needed here?
- Are route guards and async loading states explicit?
- Can this component be tested through visible behavior?

## Related Rules

- `rules/vue/overview.md` - Vue architecture principles
- `rules/vue/comments.md` - SFC component and composable documentation
- `rules/vue/testing.md` - Vitest + Vue Test Utils patterns
- `rules/vue/verification.md` - ESLint + vue-tsc configuration

## Verification Requirements

- ESLint passes with zero errors
- `vue-tsc --noEmit` type check passes
- Vitest tests pass with meaningful coverage
- Prettier formatting applied consistently
