---
name: java-backend-patterns
description: Use when building or refactoring Java backend systems, especially Spring Boot APIs, service layering, JPA persistence, DTO mapping, validation, transactions, and controller-service-repository boundaries.
---

# Java Backend Patterns

## Focus

- Keep controller, service, and persistence boundaries clear
- Define DTOs and validation before wiring handlers
- Minimize hidden transaction behavior
- Keep repository methods narrow and intention-revealing

## Workflow

1. Define request and response DTOs.
2. Keep controllers responsible for transport mapping only.
3. Move business rules into services.
4. Keep repositories storage-focused and predictable.

## Review Checklist

- Are validation rules explicit at the boundary?
- Are transaction scopes clear?
- Is mapping logic isolated instead of scattered?
- Can service tests run with minimal framework setup?

## Related Rules

- `rules/java/overview.md` - Java architecture principles
- `rules/java/comments.md` - JavaDoc comment conventions
- `rules/java/testing.md` - JUnit 5 + Mockito testing patterns
- `rules/java/verification.md` - Checkstyle + SpotBugs configuration

## Verification Requirements

- Checkstyle passes with zero errors
- SpotBugs finds no high-priority bugs
- JUnit tests pass with meaningful coverage
- google-java-format applied consistently
