---
name: typescript
description: TypeScript type-design guidance that extends JavaScript rules with explicit boundary types and invalid-state modeling.
---

# TypeScript

## Overview

This skill extends `javascript` with type-design guidance. It uses TypeScript to make contracts explicit, prevent invalid states, and improve refactor safety without duplicating JavaScript runtime guidance.

## When to Use

Use when writing or reviewing `.ts` and `.tsx` code, especially where public contracts, shared models, and complex state transitions matter.

## Hard Gates

1. Avoid `any`; if unavoidable at a boundary, isolate and narrow it immediately.
2. Define explicit types for API, persistence, and inter-module boundaries.
3. Model invalid states out of existence with unions, discriminants, and branded/value objects where helpful.
4. Keep nullability explicit; do not rely on non-null assertions as a design strategy.

## Process

1. Start from behavior and module guidance in `javascript`.
2. Introduce boundary types first (request/response, DTOs, public interfaces).
3. Encode state transitions with discriminated unions instead of boolean flag matrices.
4. Narrow unknown input early with parser/validator functions and typed results.
5. Prefer simpler type shapes that remain understandable to maintainers.

## Boundaries

This skill does not replace runtime validation and does not define framework-specific patterns. Keep runtime safety from `javascript`, and use domain/framework skills for architecture details.

## Related Skills

- `javascript`
- `frontend`, `backend`
- `react`, `vue`
- `testing`, `verification`
- `personal-defaults`
