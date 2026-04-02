---
name: frontend
description: Cross-framework frontend guidance for page/component boundaries, state ownership, and interaction completeness.
---

# Frontend

## Overview

This skill captures frontend concerns shared across frameworks. It focuses on clear page/component boundaries, deliberate state placement, and complete user-facing interactions.

## When to Use

Use when implementing or reviewing UI behavior, page flows, or component structure in any frontend stack.

## Hard Gates

1. Define clear ownership for each page and component; avoid mixed responsibilities.
2. Every async surface must handle loading, empty, and error states explicitly.
3. Interactive behavior must be complete, not partial: success, failure, disabled, and retry paths should all be intentional.

## Process

1. Choose boundaries first: what belongs to route/page level vs reusable component level.
2. Place state at the lowest level that still supports the required interactions.
3. Define user-visible state transitions for fetches and mutations before implementation.
4. Keep forms, lists, and actions behaviorally complete with predictable feedback.
5. Verify accessibility basics for semantics, keyboard access, and labeling.

## Boundaries

This skill does not own framework-specific details (React hooks, Vue composables, Next/Nuxt conventions). Use framework skills for those decisions.

## Related Skills

- `standard-workflow`
- `javascript`, `typescript`
- `react`, `vue`
- `backend`
- `testing`, `verification`
- `personal-defaults`
