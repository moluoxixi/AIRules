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
