---
name: vue
description: Vue and Nuxt guidance layered on top of frontend and typescript skills.
---

# Vue

## Overview

This skill adds Vue and Nuxt specifics on top of `frontend` and `typescript`. It emphasizes composable-first structure, clear reactive ownership, and explicit data-loading behavior.

## When to Use

Use when implementing or reviewing Vue/Nuxt code (`.vue`, composables, stores, and route/page data flows).

## Hard Gates

1. Keep reactive ownership clear: avoid mutating shared state from arbitrary components.
2. Prefer `computed` for derivations and `watch` for side effects; do not blur the two.
3. Keep composables focused and reusable; avoid large page-only composables that hide view logic.
4. Handle loading, empty, and error states explicitly for async data in pages and components.

## Process

1. Start with `frontend` boundaries and `typescript` contracts.
2. Decide where state lives (`ref`/`reactive`, composable, or store) based on sharing needs.
3. In Nuxt, choose server/client data behavior intentionally (`useAsyncData`, `useFetch`, route middleware).
4. Keep template logic readable; move non-trivial logic into script/composables.
5. Verify interaction completeness, accessibility basics, and route transition behavior.

## Boundaries

This skill does not replace shared domain/language guidance from `frontend` and `typescript`. It also does not define phase-level testing or completion verification; use `testing` and `verification`.

## Related Skills

- `standard-workflow`
- `frontend`
- `typescript`
- `testing`
- `verification`
- `personal-defaults`

