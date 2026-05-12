# Java Backend Standard

## Package Shape

Follow the project's established style. Default feature-oriented shape:

```text
order/
  OrderController.java
  OrderService.java
  OrderRepository.java
  dto/
  entity/
  exception/
```

Layer-oriented packages are acceptable when the project already uses them consistently.

## Controller

Controllers should handle HTTP concerns, validation annotations, request mapping, and response mapping. Business rules belong in service/use-case classes.

## Service

Services should hold use-case orchestration, business rules, authorization-sensitive decisions, and transaction boundaries.

Use `@Transactional` or equivalent only where atomicity is required. Avoid mixing external network calls into database transactions unless the project has an explicit outbox, saga, or compensation pattern.

## Repository

Repositories should express persistence access. Avoid embedding domain decisions, authorization checks, or response shaping in repository queries unless the project explicitly treats query services as read models.

## DTO, Entity, And Mapper

Keep request DTOs, response DTOs, entities, and mapper code separate when fields or constraints differ.

Do not expose JPA entities directly as API responses in public or unstable contracts unless the project already uses that pattern and accepts the coupling.

## Exceptions

Use explicit domain exceptions or framework exceptions. Map them to transport responses in a consistent exception handler/advice layer.

Do not catch broad exceptions and return empty success responses.
