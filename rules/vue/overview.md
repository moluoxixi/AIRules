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

## Component Directory Structure

```
ComponentName/
├── index.ts                    # Entry file, exports component and types
├── README.md                   # Component docs (keep if exists)
└── src/
    ├── index.vue               # Main component file
    ├── types/                  # TypeScript type definitions
    │   ├── index.ts            # Unified type exports
    │   ├── props.ts            # Props types
    │   ├── emits.ts            # Emits types
    │   ├── expose.ts           # defineExpose types
    │   └── types.ts            # Other types (config, field mapping, etc.)
    ├── components/             # Sub-components (if needed)
    ├── composables/            # Composables/hooks (if needed)
    └── constants/              # Constants (if needed)
```

Rules:
1. Split type files by responsibility: `props.ts`, `emits.ts`, `expose.ts`, `types.ts`
2. Only create directories that are actually needed
3. `index.ts` entry exports component and all types

## Page Directory Structure

```
PageName/
├── types/                      # TypeScript type definitions
│   ├── index.ts                # Unified type exports
│   ├── props.ts                # Props types (if needed)
│   ├── emits.ts                # Emits types (if needed)
│   ├── expose.ts               # defineExpose types (if needed)
│   └── types.ts                # Other types (API responses, form fields, etc.)
├── components/                 # Page-specific components (if needed)
├── composables/                # Composables (if needed)
├── constants/                  # Constants (if needed)
└── index.vue                   # Main page file
```

Rules:
1. Page-specific components go in local `components/`, not global `components/`
2. Only create directories that are actually needed
3. Complex pages may subdivide by functional modules
4. Page directories do **not** use a `src/` wrapper — subdirectories and the main file sit directly under the page directory

## Development Workflow

1. Identify the page boundary, route params, and data-loading path.
2. Separate UI-only state from shared state before adding a store.
3. Model forms, loading, empty, and error states explicitly.
4. Keep components presentational when possible.

## Review Checklist

- Does this logic belong in a composable instead of a component?
- Is Pinia really needed here?
- Are route guards and async loading states explicit?
- Can this component be tested through visible behavior?
