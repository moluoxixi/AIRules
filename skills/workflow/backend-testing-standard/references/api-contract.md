# API And Contract Verification

## API Behavior

Verify the API surface affected by the change:
- route and method;
- request shape;
- validation failures;
- response shape;
- status code;
- error body;
- headers or cookies when relevant;
- pagination, sorting, filtering, or idempotency semantics.

## Contract Tests

Use contract or integration tests when clients depend on stable behavior, especially for public APIs, microservice boundaries, webhooks, SDK-facing endpoints, or cross-team contracts.

Do not update snapshots or schemas without checking whether the API change is intentional.

## Error Contracts

Failure responses should be explicit and stable enough for clients to handle. Do not convert backend failures into HTTP 200 with empty data unless the API contract explicitly defines that behavior.
