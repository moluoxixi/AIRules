---
name: backend
description: Cross-stack backend guidance for API boundaries, service responsibilities, validation, and error handling.
---

# Backend

## Overview

This skill captures backend concerns that apply across stacks and frameworks. It emphasizes clear API contracts, focused service responsibilities, and predictable side-effect boundaries.

## When to Use

Use when implementing or reviewing APIs, service-layer logic, data access, or integration behavior in any backend stack.

## Hard Gates

1. Validate and normalize input at system boundaries before business logic.
2. Keep service responsibilities narrow; avoid handlers that also own persistence and orchestration internals.
3. Map internal failures to stable external error surfaces.
4. Isolate side effects (databases, queues, external APIs) behind explicit interfaces.

## Process

1. Define API/contract shapes and expected status/error outcomes.
2. Split responsibilities between transport, domain logic, and persistence.
3. Establish validation, authorization, and idempotency rules at boundaries.
4. Make writes and side effects explicit, observable, and testable.
5. Add behavior-focused tests around success, failure, and boundary cases.

## Boundaries

This skill is stack-agnostic and does not prescribe framework-specific patterns (Nest modules, Spring layers, Django conventions, etc.). Use stack/framework skills for those details.

## Related Skills

- `standard-workflow`
- `javascript`, `typescript`
- `frontend`
- `testing`, `verification`
- `personal-defaults`
