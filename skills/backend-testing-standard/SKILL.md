---
name: backend-testing-standard
description: Use when testing, verifying, or reviewing backend changes involving APIs, services, repositories, DTO validation, database access, transactions, authorization, integration tests, contract tests, NestJS tests, Java tests, coverage, or server-side delivery quality.
---

# Backend Testing Standard

## Overview

This skill defines what backend changes must verify. It does not require fixed command names; commands must be discovered from the project.

Use stricter project, user, or CI rules when present.

## Load References

- Backend test dimensions and command discovery: read `references/test-dimensions.md`.
- API and contract verification: read `references/api-contract.md`.
- Database, transaction, and persistence testing: read `references/database-and-transaction.md`.
- NestJS testing patterns: read `references/nest.md`.
- Java/Spring-style testing patterns: read `references/java.md`.

## Required Testing Dimensions

At minimum, evaluate:
- static quality;
- type or compile correctness;
- unit tests for pure rules and services;
- controller/API behavior;
- validation and error mapping;
- authorization and permission boundaries;
- repository/database behavior when persistence changed;
- transaction success and rollback behavior when writes changed;
- integration or contract behavior for external-facing APIs;
- coverage when tooling exists or meaningful logic changed.

If a dimension has no project tool or entry point, report it as `MISSING`. If it cannot be run, report `NOT RUN` with the reason.

## No Fake Passes

Do not mock away the unit under test, remove assertions, lower thresholds, hide database failures, convert exceptions into success paths, or skip failed integration behavior to make the report look green.
