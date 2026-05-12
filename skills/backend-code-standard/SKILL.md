---
name: backend-code-standard
description: Use when writing, modifying, or reviewing backend code involving APIs, controllers, routes, DTOs, services, repositories, entities, database access, transactions, exceptions, logging, configuration, NestJS, Java, Spring-style projects, or server-side module boundaries.
---

# Backend Code Standard

## Overview

This skill defines backend coding standards for API boundaries, layering, naming, error semantics, transactions, persistence, logging, and configuration. It applies to Node/NestJS, Java/Spring-style projects, and general backend services.

Prefer existing project conventions. When the project has no clear convention, use this skill as the default backend standard.

## Load References

- Common backend architecture, naming, layering, DTO/entity boundaries, exceptions, logging, and configuration: read `references/common.md`.
- NestJS-specific module, controller, provider, DTO, pipe, guard, interceptor, and exception patterns: read `references/nest.md`.
- Java/Spring-style package, controller, service, repository, DTO, entity, transaction, and exception patterns: read `references/java.md`.

## Core Rules

- Keep API, domain, persistence, and infrastructure boundaries explicit.
- Do not let controllers contain business rules; controllers should validate input, call application/service logic, and shape transport responses.
- Do not let repositories contain business decisions; repositories should express persistence access and constraints.
- Keep DTOs, entities, persistence models, and response views separate when their constraints differ.
- Preserve failure semantics. Do not convert real backend errors into empty objects, default success, cached results, or swallowed exceptions.
- Use transactions only around operations that must commit or roll back together. Keep transaction scope small and visible.
- Log with enough context to diagnose failures, but never log secrets, tokens, passwords, private keys, or full authentication headers.

## Related Skills

- Backend tests and delivery verification: use `backend-testing-standard`.
- General task flow and quality gates: use `software-development-workflow`.
- Bug, failing test, or unexpected server behavior: use `systematic-debugging`.
