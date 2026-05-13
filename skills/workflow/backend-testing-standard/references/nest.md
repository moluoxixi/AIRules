# NestJS Testing Standard

## Unit Tests

Use the project's Nest testing approach when present. Service tests should mock repositories and external adapters only at the boundary being tested.

Do not mock the service method under test.

## Controller/API Tests

Controller tests should verify routing-level behavior, validation pipes, guards when relevant, status codes, and response shapes.

For behavior that depends on the full Nest application context, prefer an integration or E2E-style test using the project's established setup.

## Providers

When overriding providers, ensure the fake preserves failure behavior needed by the test. A mock that always succeeds cannot verify error paths.

## Validation And Exceptions

Cover DTO validation failures and exception filters when the change affects request contracts or error responses.
