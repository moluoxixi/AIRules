# Nest Rules Overview

Applicable to NestJS projects.

## Architecture Principles

- Module / controller / service / dto layers are explicit
- Provider dependencies are converged, no direct cross-layer coupling
- Parameter validation, configuration loading, and exception filtering are standardized first

## Related Rules

- [comments.md](./comments.md) - TSDoc comment standards
- [testing.md](./testing.md) - Jest + supertest testing standards
- [verification.md](./verification.md) - ESLint + tsc --noEmit + Prettier verification

## Development Workflow

1. Define the module boundary and public providers.
2. Design DTOs before controller implementation.
3. Keep controller methods focused on transport concerns.
4. Push business rules into services and domain helpers.

## Review Checklist

- Are DTOs and validation rules defined before logic branches?
- Is configuration loaded through a dedicated module or service?
- Are auth, logging, and error handling standardized?
- Can service logic be tested without HTTP transport?
