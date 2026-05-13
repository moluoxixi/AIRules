# Coverage And Risk

## Baseline

Use project coverage thresholds when defined. If none exist, report against 80% statements, branches, functions, and lines.

New or modified logic should aim for at least 90% meaningful coverage.

## High-Risk Logic

The following require success, failure, boundary, and exception-path coverage:
- authentication and authorization;
- payment;
- deletion;
- data migration;
- security boundaries;
- core business rules;
- irreversible user actions;
- complex async coordination.

## Invalid Ways To Pass

Do not:
- lower thresholds;
- exclude key files;
- delete assertions;
- snapshot broad output without behavior assertions;
- mock the unit under test;
- convert errors to success paths;
- remove tests for failing behavior.

If coverage cannot be collected, report the missing tool or config and explain the risk.
