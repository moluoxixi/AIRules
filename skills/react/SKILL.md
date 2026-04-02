---
name: react
description: React and Next.js guidance layered on top of frontend and typescript skills.
---

# React

## Overview

This skill adds React and Next.js specifics on top of `frontend` and `typescript`. It focuses on component boundaries, hook discipline, and rendering/data choices in modern React apps.

## When to Use

Use when implementing or reviewing React/Next code (`.tsx`, route handlers, server/client components, hooks, and UI state flow).

## Hard Gates

1. Respect server/client boundaries in Next.js; use `'use client'` only when interactivity is required.
2. Keep hooks deterministic and top-level; avoid conditional hook execution.
3. Prefer derived state and controlled data flow over duplicated local state.
4. Ensure loading, empty, and error states are explicit for async UI surfaces.

## Process

1. Start with `frontend` boundaries and `typescript` contracts.
2. Choose rendering strategy intentionally (server component, client component, or hybrid).
3. Keep side effects in `useEffect` minimal and idempotent; move pure computation outside effects.
4. Use custom hooks when logic is shared across multiple components.
5. Verify interaction paths, accessibility basics, and route-level state transitions.

## Boundaries

This skill does not replace shared domain/language guidance from `frontend` and `typescript`. It also does not redefine testing/verification workflow; use `testing` and `verification` for those phases.

## Related Skills

- `standard-workflow`
- `frontend`
- `typescript`
- `testing`
- `verification`
- `personal-defaults`

