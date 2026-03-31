# Java Rules Overview

Applicable to Java / Spring Boot projects.

## Architecture Principles

- Controller, service, repository roles are stable
- DTO, validation, exception handler are explicit
- Transaction boundaries and data access layer are clear

## Related Rules

- [comments.md](./comments.md) - JavaDoc comment standards
- [testing.md](./testing.md) - JUnit 5 + Mockito testing standards
- [verification.md](./verification.md) - Checkstyle + SpotBugs + google-java-format verification

## Development Workflow

1. Define request and response DTOs.
2. Keep controllers responsible for transport mapping only.
3. Move business rules into services.
4. Keep repositories storage-focused and predictable.

## Review Checklist

- Are validation rules explicit at the boundary?
- Are transaction scopes clear?
- Is mapping logic isolated instead of scattered?
- Can service tests run with minimal framework setup?
