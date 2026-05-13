# Backend Test Dimensions

## Command Discovery

Find commands from:
- package/build files such as `package.json`, `pom.xml`, `build.gradle`, `gradle.properties`, workspace files;
- framework configs such as NestJS, Jest, Vitest, Spring Boot, JUnit, Testcontainers;
- CI files;
- repository docs;
- project instructions.

Examples are illustrative only: `pnpm test`, `npm run test:e2e`, `mvn test`, `mvn verify`, `gradle test`, `gradle check`.

## Static And Compile Checks

Run available lint, format, typecheck, compile, or build checks. Java projects usually require compile/test tasks; TypeScript backend projects usually require lint and type checks.

## Unit Tests

Cover:
- pure business rules;
- service decision branches;
- DTO validation helpers;
- error conversion;
- idempotency keys and retry decisions;
- permission rule functions;
- data mapping and serialization.

## Service And API Tests

Cover:
- success responses;
- invalid input;
- missing resources;
- forbidden or unauthorized requests;
- conflict and duplicate cases;
- downstream failure propagation;
- expected status codes and response bodies.

## Coverage

Use project thresholds first. If none exist, report against 80% statements, branches, functions/methods, and lines where the tooling supports those metrics.

Changed business logic should aim for 90%+ meaningful coverage.
