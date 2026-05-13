---
name: software-development-workflow
description: Use when starting, planning, implementing, testing, reviewing, or delivering any software development task, including feature work, bug fixes, refactors, multi-step changes, task splitting, quality gates, or handoff reports.
---

# Software Development Workflow

## Overview

This skill defines a standard software development workflow for any project. It coordinates requirements, design, implementation, verification, review, and delivery without replacing technology-specific skills.

Use existing project rules first. If project or user rules are stricter than this skill, follow the stricter rule.

## Workflow

1. **Context**: identify project type, tech stack, existing scripts, relevant files, and current git state.
2. **Requirement**: restate the task, acceptance criteria, non-goals, risks, and unknowns. Ask only when a missing answer blocks safe work.
3. **Split**: decide whether the task is small enough for one change, needs subtasks, or should dispatch parallel agents. See `references/task-splitting.md`.
4. **Design**: define boundaries, data contracts, error behavior, and affected files before editing.
5. **Implement**: make the smallest coherent change that satisfies the requirement. Preserve existing patterns.
6. **Verify**: run discovered project checks for static analysis, type checks, tests, coverage, build, and task-specific behavior. See `references/quality-gate.md`.
7. **Review**: inspect the diff for correctness, missing tests, unrelated churn, and failure masking.
8. **Report**: summarize changed behavior, commands run, results, missing tools, and residual risk. See `references/delivery-report.md`.

## Load Supporting Standards

- Frontend code, UI, components, pages, hooks, composables, routing, or state: use `frontend-code-standard`.
- Frontend validation, browser checks, component tests, visual responsiveness, accessibility, E2E, or coverage: use `frontend-testing-standard`.
- Backend code, APIs, services, repositories, database access, DTOs, NestJS, Java, Spring-style layering, transactions, or server-side error handling: use `backend-code-standard`.
- Backend unit, API, integration, database, transaction, contract, authorization, or service tests: use `backend-testing-standard`.
- Vue work: use `vue-best-practices`; for Vue tests also use `vue-testing-best-practices`.
- Vitest configuration, mocking, fixtures, or coverage: use `vitest`.
- Browser interaction or E2E verification: use `playwright` or the available browser tool.
- Two or more independent tasks, failures, modules, or research tracks: use `dispatching-parallel-agents` when the host supports subagents.
- Independent implementation subtasks in one session: use `subagent-driven-development` when available.
- Bug, failing test, or unexpected behavior: use `systematic-debugging`.
- Implementation before code in a non-trivial task: use `test-driven-development` when applicable.
- Completion claim, commit, PR, or delivery: use `verification-before-completion`.

## State And Concurrency

Use lightweight project-local notes only when they materially prevent context loss or task collision. Do not force every task into a persistent state machine.

Before implementation, evaluate whether the work can run in parallel. Use multiple subagents or parallel sessions when there are two or more independent problem domains, non-overlapping write scopes, and independent verification paths. Keep coordination, integration, and final verification in the parent agent.

For concurrent or cross-conversation work, track:
- business or feature title;
- active task title;
- file or module scope;
- current status;
- blocking decisions;
- verification status.

If two active tasks may edit the same files or contracts, stop and split the scope, use a separate branch/worktree, or ask the user to choose priority. Do not silently merge conflicting work.

## Failure Semantics

Do not hide real failures with defaults, empty objects, cached output, silent fallback, or fake success. If an error is caught, add context or cleanup, then rethrow or return an equivalent failure state.

Missing scripts, missing tools, failing checks, insufficient coverage, or unverified browser behavior are delivery concerns. Report them as `MISSING`, `FAILED`, or `NOT RUN`, never as passed.
