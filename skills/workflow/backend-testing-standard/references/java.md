# Java Backend Testing Standard

## Unit Tests

Use the project's established framework, such as JUnit and Mockito. Unit tests should cover service rules, mappers, validators, and failure branches.

Do not mock the class under test.

## Spring-Style Integration Tests

Use the project's established integration approach when behavior depends on framework wiring, persistence, transactions, security filters, or serialization.

Common categories:
- controller/API tests;
- service tests with real transaction behavior;
- repository tests;
- Testcontainers or embedded database tests when the project uses them.

## Security And Validation

Cover authentication, authorization, validation annotations, exception handlers, and forbidden paths when the change affects protected APIs or request contracts.

## Build Verification

For Java projects, compile and test tasks are part of the quality gate. Use project commands such as Maven or Gradle only when the project actually uses them.
