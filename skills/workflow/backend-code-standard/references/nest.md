# NestJS Standard

## Module Boundary

Group code by business module when the project supports it:

```text
orders/
  orders.module.ts
  orders.controller.ts
  orders.service.ts
  dto/
  entities/
  repositories/
```

Shared modules should contain genuinely shared providers. Do not move feature-specific providers into shared modules prematurely.

## Controller

Controllers should:
- declare routes and transport metadata;
- receive validated DTOs;
- call service methods;
- map transport-specific response details when needed.

Controllers should not contain business rules, database queries, transaction orchestration, or external service workflows.

## Service

Services should:
- orchestrate use cases;
- enforce business rules;
- coordinate repositories and external adapters;
- define transaction scope where the project pattern places it;
- throw explicit domain or framework exceptions for failure.

## DTO And Validation

DTOs should represent request or response contracts. Use the project's validation approach, such as pipes, class-validator, Zod, or schema validation.

Do not rely on controller body objects as untyped dictionaries when DTOs exist.

## Guards, Pipes, Interceptors, Filters

- guards: authorization and access checks;
- pipes: transformation and validation;
- interceptors: cross-cutting behavior such as serialization, timing, or response wrapping;
- filters: exception-to-response mapping.

Do not hide business failures inside interceptors or filters as successful responses.

## Exceptions

Use explicit exceptions for invalid state, missing resources, authorization failures, and conflict conditions. Preserve cause context when wrapping infrastructure errors.
