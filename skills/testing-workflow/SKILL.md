---
name: testing-workflow
description: "Use when writing tests or verifying test coverage to follow the standard test strategy and execution flow"
---

# Testing Workflow

## Overview

Standard workflow for writing, running, and validating tests with MCP integration for automated execution.

## When to Use

- Writing new tests
- Verifying test coverage meets targets
- Debugging test failures
- Setting up test infrastructure

## Core Pattern

```
Select Strategy → Write Tests → Run → Coverage Check
```

### 1. Select Strategy

Follow the Test Pyramid:
- **Unit tests** (70%): Fast, isolated, test business logic
- **Integration tests** (20%): Verify component interactions
- **E2E tests** (10%): Critical user paths only

### 2. Write Tests

Structure:
- Follow Arrange-Act-Assert pattern
- One logical assertion per test
- Name format: `should_do_something_when_condition`
- Use factory functions for test data

Mocking guidelines:
- Mock external dependencies (DB, APIs, filesystem)
- Minimize mocking internal code
- Never mock what you don't own without abstraction

### 3. Run Tests (MCP Integration)

```
# Execute via MCP tools
- Run test command appropriate for stack
- Retrieve test reports through MCP
- Analyze failures with context
```

Coverage targets:
- Core business logic: minimum 80%
- Utility functions: 100%
- Infrastructure/boilerplate: optional

### 4. Coverage Check

- Verify coverage targets met
- Focus on meaningful assertions, not just line coverage
- Document exclusions with justification

## Stack-Specific Guides

- Java: `rules/java/testing.md` - JUnit 5 + Mockito
- Python: `rules/python/testing.md` - pytest
- Go: `rules/go/testing.md` - standard testing package
- React: `rules/react/testing.md` - Vitest/Jest + Testing Library
- Vue: `rules/vue/testing.md` - Vitest + Vue Test Utils
- Nest: `rules/nest/testing.md` - Jest + supertest
- Rust: `rules/rust/testing.md` - `#[test]` + proptest

## Related Rules

- `rules/common/testing-standards.md` - Complete testing principles
- `rules/frontend/testing.md` - Frontend-specific testing

## Verification Requirements

- All tests pass
- Coverage targets met
- No test failures without documented reason
- MCP test execution steps documented
