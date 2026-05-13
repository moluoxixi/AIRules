# Common Backend Code Standard

## Layer Boundaries

Default backend layers:
- route/controller: transport boundary, request validation, response shaping;
- application/service: use-case orchestration and business rules;
- domain/model: domain invariants and pure rules when the project has a domain layer;
- repository/DAO/mapper: persistence access;
- infrastructure/client: external services, queues, caches, object storage, and SDK adapters;
- configuration: environment parsing and runtime options.

Keep dependencies pointing inward where the architecture supports it. Avoid importing controllers from services or repositories from DTOs.

## Naming

Use project conventions first. Defaults:
- API handlers/controllers: noun or resource name plus transport suffix, such as `OrderController`.
- services/use cases: business capability, such as `OrderApprovalService`.
- repositories/DAOs: aggregate or table name plus persistence suffix, such as `OrderRepository`.
- DTOs: operation and direction, such as `CreateOrderRequest`, `OrderDetailResponse`.
- errors/exceptions: domain reason, such as `OrderNotFoundError`.

## DTO, Entity, And View Boundaries

- Request DTOs describe accepted input, not database rows.
- Response DTOs describe public output, not internal entities.
- Entities or persistence models describe stored state and invariants.
- Do not expose persistence-only fields unless the API contract requires them.
- Do not accept client-controlled values for server-owned fields such as ids, tenant id, audit fields, roles, or status transitions unless explicitly designed.

## Error Semantics

Errors must remain visible:
- validation errors should identify invalid fields or business constraints;
- domain errors should map to explicit failure responses;
- infrastructure errors should preserve enough cause context for diagnosis;
- catch blocks may add context or cleanup, then rethrow or return an equivalent failure result.

Do not return success with empty data after a failed write, failed authorization check, failed external call, or failed transaction.

## Transactions

Use a transaction when multiple writes or read-modify-write operations must be atomic. Keep transaction boundaries in service/use-case code unless the framework has an established pattern.

Do not perform long-running external calls inside a transaction unless the project explicitly accepts that risk.

## Logging And Configuration

Configuration must fail fast when required values are missing or malformed. Do not silently default production-critical URLs, credentials, feature flags, or security options.

Logs should include request or correlation ids where available, but must redact secrets and user-sensitive data.
