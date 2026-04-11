---
name: vue-best-practices
description: MUST be used for Vue.js tasks. Strongly recommends Composition API with `<script setup>` and TypeScript as the standard approach. Covers Vue 3, SSR, Volar, vue-tsc. Load for any Vue, .vue files, Vue Router, Pinia, or Vite with Vue work. ALWAYS use Composition API unless the project explicitly requires Options API. Includes Moluoxixi's specific directory structuring rules.
license: MIT
metadata:
  author: Moluoxixi (Forked from github.com/vuejs-ai)
  version: "18.0.0-moluoxixi"
---

# Vue Best Practices Workflow

Use this skill as an instruction set. Follow the workflow in order unless the user explicitly asks for a different order.

## 0) Moluoxixi's Project Directory Rules (CRITICAL)
Whenever scaffolding, extracting, or creating new components and modules, you MUST strictly adhere to this directory organization:
- **Views/Pages**: Route-level view components must be placed in `src/views` (or `pages` if using Nuxt).
- **Reusable UI/Components**: Feature and shared components must be placed in `src/components`, properly nested by feature if necessary.
- **Composables/Hooks**: Extract logic and state into composables located in `src/composables`.
- **Stores**: Use Pinia and place store definitions in `src/stores`.
- **Utils**: Non-Vue helper functions must go in `src/utils`.
- **Assets**: Static media, icons, and base styles should go in `src/assets`.

**Never arbitrarily place `.vue` or `.ts` files at random root folders.** Keep the project neatly structured according to these conventions.

---

## Core Principles
- **Keep state predictable:** one source of truth, derive everything else.
- **Make data flow explicit:** Props down, Events up for most cases.
- **Favor small, focused components:** easier to test, reuse, and maintain.
- **Avoid unnecessary re-renders:** use computed properties and watchers wisely.
- **Readability counts:** write clear, self-documenting code.

## 1) Confirm architecture before coding (required)

- Default stack: Vue 3 + Composition API + `<script setup lang="ts">`.
- If the project explicitly uses Options API, load `vue-options-api-best-practices` skill if available.
- If the project explicitly uses JSX, load `vue-jsx-best-practices` skill if available.

### 1.1 Read Core Concepts
Apply single-file component safety, declarative template logic, reactivity boundaries, and proper data flow handling throughout tasks.

### 1.2 Plan component boundaries before coding (required)

Create a brief component map before implementation for any non-trivial feature.
- Define each component's single responsibility in one sentence.
- Keep entry/root and route-level view components as composition surfaces by default.
- Move feature UI and feature logic out of entry/root/view components.
- Prefer a feature folder layout (`components/<feature>/...`, `composables/use<Feature>.ts`) when adding more than one component.

## 2) Apply essential Vue foundations (required)

### Reactivity
- Keep source state minimal (`ref`/`reactive`), derive everything possible with `computed`.
- Use watchers for side effects if needed.
- Avoid recomputing expensive logic in templates.

### SFC structure and template safety
- Keep SFC sections in this order: `<script>` → `<template>` → `<style>`.
- Keep SFC responsibilities focused; split large components.
- Keep templates declarative; move branching/derivation to script.

### Keep components focused
Split a component when it has **more than one clear responsibility**.
- Prefer **smaller components + composables** over one “mega component”.
- Move **UI sections** into child components (props in, events out).
- Move **state/side effects** into composables (`useXxx()`).

### Component data flow
- Use props down, events up as the primary model.
- Use `v-model` only for true two-way component contracts.
- Use provide/inject only for deep-tree dependencies or shared context.

### Composables
- Extract logic into composables when it is reused, stateful, or side-effect heavy.
- Keep composable APIs small, typed, and predictable.

## 3) Post-Coding Validation Requirements
See the `moluoxixi` toolkit configuration. You are strictly mandated to run formatting/linting tools AFTER every single Vue component implementation to ensure standards are met.
