# Rust Rules Overview

Applicable to Rust services, CLI, and tooling projects.

## Architecture Principles

- Error types are explicitly modeled
- I/O is separated from pure logic
- Concurrency and async behavior must be testable
- Module boundaries remain small and clear

## Related Rules

- [comments.md](./comments.md) - rustdoc (`///`, `//!`) comment standards
- [testing.md](./testing.md) - `#[test]` + proptest testing standards
- [verification.md](./verification.md) - Clippy + rustfmt + cargo audit verification

## Development Workflow

1. Identify which code is pure logic and which code touches I/O.
2. Introduce typed request and response models early.
3. Model failure paths before widening concurrency.
4. Add integration points only after core logic is testable.

## Review Checklist

- Are errors propagated with enough context?
- Is async work isolated behind clear functions or traits?
- Can core logic be tested without the network or database?
- Are serialization and validation boundaries explicit?
