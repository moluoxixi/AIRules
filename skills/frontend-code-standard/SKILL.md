---
name: frontend-code-standard
description: Use when writing, modifying, or reviewing frontend code involving UI, components, pages, routes, state, API clients, hooks, composables, TypeScript models, naming, directory structure, or frontend module boundaries.
---

# Frontend Code Standard

## Overview

This skill defines frontend coding standards for naming, directory structure, module boundaries, comments, and UI logic organization. It applies across Vue, React, and general TypeScript/JavaScript frontend projects.

Prefer the project's existing conventions. When the project has no clear convention, use this skill as the default standard.

## Load References

- General naming, comments, colocation, API alignment, and TypeScript principles: read `references/common.md`.
- Directory and feature structure: read `references/directory-structure.md`.
- Vue SFCs, composables, refs, and events: read `references/vue.md`.
- React components, hooks, refs, and events: read `references/react.md`.
- TypeScript and JavaScript naming examples: read `references/typescript-javascript.md`.

## Core Rules

- Keep view files focused on rendering and wiring. Extract data fetching, validation, derived state, and business rules into hooks, composables, stores, services, or pure modules.
- Define types and constants before implementation when they clarify contracts.
- Keep feature-specific files close to the feature unless they are genuinely reused across multiple features.
- Align frontend fields with backend/API contracts. Do not invent compatibility fields, fake rows, or fallback semantics without explicit requirements.
- Use comments to explain responsibility, boundary, input/output constraints, side effects, and failure semantics. Do not write comments that only repeat code behavior.

## Framework Skills

- Vue code must also use `vue-best-practices`; Vue tests should also use `vue-testing-best-practices`.
- React code can use installed React-specific skills when available; otherwise follow React official component purity and hook boundary principles through this skill.
- Styling, accessibility, or visual review should also use `web-design-guidelines` when available.
