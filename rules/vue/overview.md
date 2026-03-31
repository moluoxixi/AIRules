# Vue Rules Overview

Applicable to Vue 3 / Nuxt 3 / Vite / Pinia / Vue Router projects.

## Architecture Principles

- Prefer Composition API
- Store holds only shared state
- Composables manage reusable logic
- Page layer handles routing and assembly; component layer handles presentation

## Related Rules

- [comments.md](./comments.md) - SFC components, composables comment standards
- [testing.md](./testing.md) - Vitest + Vue Test Utils testing standards
- [verification.md](./verification.md) - ESLint + vue-tsc + Prettier verification
- [frontend/workflow.md](../frontend/workflow.md) - Page task standard workflow
