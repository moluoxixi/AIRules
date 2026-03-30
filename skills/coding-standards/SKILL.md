---
name: coding-standards
description: "Use when writing or modifying code to ensure naming, structure, and error handling follow standards"
---

# Coding Standards

## Overview

Cross-language coding standards for naming, function design, type safety, error handling, and security.

## When to Use

- Writing new code
- Refactoring existing code
- Reviewing code for standards compliance

## Core Pattern

### Naming & Semantics
- Names describe intent, not implementation
- Avoid abbreviations; clarity over brevity
- Boolean names imply true/false (`isValid`, `hasPermission`)
- Collection names are plural (`users`, not `userList`)

### Function Design
- Single Responsibility: one function, one thing
- Early returns to reduce nesting (max 3 levels)
- Pure functions preferred; minimize side effects
- Avoid flag parameters that change behavior

### Type Safety
- Prefer explicit types over implicit coercion
- Null/undefined checks at boundaries
- Fail fast on invalid inputs
- Make invalid states unrepresentable

### Error Handling
- Explicit handling over silent failures
- Never swallow exceptions without logging
- Distinguish recoverable vs fatal errors
- Validate inputs at public API boundaries

### Security
- Validate all external inputs
- Never log sensitive data (credentials, tokens, PII)
- Use parameterized queries
- Apply principle of least privilege

## Stack-Specific Guides

Load corresponding rules based on technology:
- Java: `rules/java/overview.md`, `rules/java/comments.md`
- Python: `rules/python/overview.md`, `rules/python/comments.md`
- Go: `rules/go/overview.md`, `rules/go/comments.md`
- React: `rules/react/overview.md`, `rules/react/comments.md`
- Vue: `rules/vue/overview.md`, `rules/vue/comments.md`
- Nest: `rules/nest/overview.md`, `rules/nest/comments.md`
- Rust: `rules/rust/overview.md`, `rules/rust/comments.md`

## Related Rules

- `rules/common/coding-standards.md` - Complete coding standards
- `rules/common/comments.md` - Comment conventions

## Verification Requirements

- Naming conventions followed
- Maximum nesting depth ≤ 3
- All public inputs validated
- No sensitive data in logs
