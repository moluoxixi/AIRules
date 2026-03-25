---
name: rust-service-patterns
description: Use when building or refactoring Rust backend services, async workers, CLIs, or APIs with Tokio, Axum, Actix, Serde, explicit error handling, module boundaries, and testable business logic.
---

# Rust Service Patterns

## Focus

- Keep pure logic independent from I/O
- Use explicit error types
- Make async boundaries visible
- Favor small modules with strong types

## Workflow

1. Identify which code is pure logic and which code touches I/O.
2. Introduce typed request and response models early.
3. Model failure paths before widening concurrency.
4. Add integration points only after core logic is testable.

## Review Checklist

- Are errors propagated with enough context?
- Is async work isolated behind clear functions or traits?
- Can core logic be tested without the network or database?
- Are serialization and validation boundaries explicit?
