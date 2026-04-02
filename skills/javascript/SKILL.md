---
name: javascript
description: JavaScript implementation guidance for async behavior, module boundaries, runtime safety, and readable transformations.
---

# JavaScript

## Overview

This skill covers JavaScript-specific implementation decisions. It focuses on making runtime behavior explicit, asynchronous flow predictable, and error surfaces clear.

## When to Use

Use when writing or reviewing `.js`, `.mjs`, or JavaScript-first logic in mixed repositories.

## Hard Gates

1. Never leave promise rejections unhandled.
2. Keep modules small and purpose-driven with explicit inputs/outputs.
3. Treat external input as untrusted and validate before use.
4. Do not hide failures behind silent fallbacks.

## Process

1. Define module boundaries before coding; one unit should have one reason to change.
2. Prefer straightforward async flow (`async/await`) over nested chains when possible.
3. Keep transformations readable; favor named steps over dense one-liners.
4. Surface errors with enough context for debugging while preserving stable caller behavior.
5. Add tests for success path, expected failure path, and edge conditions.

## Boundaries

This skill does not define domain architecture (`frontend`/`backend`) or framework details (`react`/`vue`). For static type modeling and compile-time guarantees, layer `typescript` on top.

## Related Skills

- `standard-workflow`
- `frontend`, `backend`
- `typescript`
- `testing`, `verification`
- `personal-defaults`
