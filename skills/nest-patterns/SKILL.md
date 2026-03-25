---
name: nest-patterns
description: Use when building or refactoring NestJS applications, including modules, controllers, services, DTOs, guards, pipes, interceptors, validation, configuration, and test boundaries.
---

# Nest Patterns

## Focus

- Keep controllers thin
- Move business logic into services
- Validate inputs with DTOs and pipes
- Centralize cross-cutting behavior with guards, interceptors, and filters

## Workflow

1. Define the module boundary and public providers.
2. Design DTOs before controller implementation.
3. Keep controller methods focused on transport concerns.
4. Push business rules into services and domain helpers.

## Review Checklist

- Are DTOs and validation rules defined before logic branches?
- Is configuration loaded through a dedicated module or service?
- Are auth, logging, and error handling standardized?
- Can service logic be tested without HTTP transport?
