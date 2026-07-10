---
name: test-evidence
description: Design and verify risk-based test evidence mapped to OpenSpec scenario IDs. Use before implementation to create test-plan.md, after implementation to collect actual evidence, and whenever coverage, test oracles, flaky behavior, browser validation, or release readiness is disputed.
---

# Build test evidence

Create `test-plan.md` with one or more test cases for every `SCN-*`. Each test case must include:

- `covers: SCN-*`
- layer and risk addressed
- environment and test data
- executable command or controlled manual procedure
- observable oracle
- evidence output location

Select unit, contract, integration, E2E/browser, security, performance, migration, and resilience coverage according to the change risk. Do not substitute a coverage percentage for scenario traceability.

During verification, run the commands and record exit status, relevant output, and artifact paths. Mark unavailable tooling as `MISSING blocked` or `NOT RUN` with a reason. Never infer PASS from implementation summaries or repeated retries.

Classify an incorrect test oracle separately from an implementation defect and route it through `correction-loop`.
