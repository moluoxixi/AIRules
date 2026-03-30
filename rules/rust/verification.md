# Rust Verification

Quality gates for Rust projects.

## Static Analysis Tools

| Tool | Purpose | Command |
|------|---------|---------|
| Clippy | Linting and best practices | `cargo clippy` |
| rustfmt | Code formatting | `cargo fmt` |
| cargo audit | Security vulnerability scan | `cargo audit` |
| cargo deny | License and dependency check | `cargo deny check` |

## Clippy Configuration

Fail on warnings in CI:

```bash
# Strict mode - deny all warnings
cargo clippy -- -D warnings

# Common additional lints
cargo clippy -- -W clippy::pedantic -W clippy::nursery
```

## Formatting

```bash
# Check formatting
cargo fmt -- --check

# Apply formatting
cargo fmt
```

## Build Verification

```bash
# Debug build
cargo build

# Release build with optimizations
cargo build --release

# Check compilation without producing binaries (faster)
cargo check

# Full verification pipeline
cargo fmt -- --check && cargo clippy -- -D warnings && cargo test && cargo audit
```

## Security Scanning

```bash
# Install cargo-audit
cargo install cargo-audit

# Scan for vulnerabilities
cargo audit

# Check for outdated dependencies
cargo outdated
```

## Pre-Commit Checklist

- [ ] `cargo fmt -- --check` passes
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo test` passes
- [ ] `cargo build --release` succeeds
- [ ] `cargo audit` shows no vulnerabilities

## CI Configuration

```yaml
# .github/workflows/rust.yml
- name: Check formatting
  run: cargo fmt -- --check

- name: Run Clippy
  run: cargo clippy -- -D warnings

- name: Run tests
  run: cargo test

- name: Security audit
  run: cargo audit
```

## Documentation Build

```bash
# Build and test documentation
cargo doc --no-deps
cargo test --doc
```
