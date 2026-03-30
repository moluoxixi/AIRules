---
name: post-coding-verification
description: "Use after code is written and before commit to run the standard verification pipeline"
---

# Post-Coding Verification

## Overview

Standard verification pipeline to run after coding and before commit: lint → typecheck → build → security.

## When to Use

- Code implementation complete
- Before committing changes
- Before creating pull request
- CI/CD pipeline validation

## Core Pattern

```
Lint → Type Check → Build → Security Scan
```

### 1. Lint

- Must pass with zero errors
- Target zero warnings
- No unused variables, imports, or dead code
- Consistent code style

### 2. Type Check

- Type checker passes with no errors
- No implicit any or equivalent escape hatches
- All public API signatures explicitly typed

### 3. Build

- Clean build must succeed
- No build warnings indicating potential issues
- Output artifacts generated correctly
- Build reproducible

### 4. Security Scan

- Dependency vulnerability scan passes
- No high/critical severity vulnerabilities
- Secrets/credentials not committed
- Security-sensitive code paths reviewed

## Stack-Specific Commands

| Stack | Lint | Type Check | Build | Security |
|-------|------|------------|-------|----------|
| Java | Checkstyle | - | Maven/Gradle | SpotBugs |
| Python | ruff/flake8 | mypy/pyright | - | bandit/safety |
| Go | golangci-lint | - | go build | gosec |
| React/Vue/Nest | ESLint | tsc | build | npm audit |
| Rust | Clippy + rustfmt | - | cargo build | cargo audit |

## Stack-Specific Guides

- Java: `rules/java/verification.md`
- Python: `rules/python/verification.md`
- Go: `rules/go/verification.md`
- React: `rules/react/verification.md`
- Vue: `rules/vue/verification.md`
- Nest: `rules/nest/verification.md`
- Rust: `rules/rust/verification.md`

## Related Rules

- `rules/common/verification.md` - Complete verification standards

## Verification Requirements

- [ ] Lint passes with zero errors
- [ ] Type check passes (if applicable)
- [ ] Tests pass (unit and integration)
- [ ] Build succeeds
- [ ] Security scan passes
- [ ] Formatting is consistent

## Failure Response

- Fix issues at the source, don't bypass checks
- Document suppressions with justification
- Never commit with "will fix later" assumptions
