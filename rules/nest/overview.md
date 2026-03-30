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
