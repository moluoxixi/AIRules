# Everything Claude Code (ECC) — Agent Instructions

This project uses specialized agents for planning, TDD, implementation review, test analysis, end-to-end verification, and failure diagnosis.

## Core Principles

1. **Agent-First** — Delegate domain work to specialized agents when the host supports them.
2. **Plan Before Execute** — Use planning support for complex features, refactors, migrations, and multi-file changes.
3. **Test-Driven** — Use TDD guidance for new features, bug fixes, and behavior changes.
4. **Review Immediately** — Use review agents after writing or modifying code; address critical and high-severity findings before continuing.
5. **Verify Honestly** — Do not claim agent work happened when the host cannot dispatch agents or the required agent is unavailable.

## Available Agents

| Agent | Purpose | When to Use |
|---|---|---|
| planner | Implementation planning | Complex features, refactoring, migrations, multi-step changes |
| tdd-guide | Test-driven development | New features, bug fixes, behavior changes |
| pr-test-analyzer | Test coverage analysis | After implementation, before final verification |
| e2e-runner | End-to-end Playwright testing | Critical user flows, navigation, permissions, regression smoke |
| code-reviewer | Code quality and maintainability | After writing or modifying code |
| typescript-reviewer | TypeScript / JavaScript review | Type changes, interfaces, API clients, store logic, utilities |
| react-reviewer | React review | JSX/TSX, hooks, component state, rendering behavior |
| vue-reviewer | Vue review | SFCs, composables, reactivity, component state, rendering behavior |
| react-build-resolver | React build diagnosis | React build, hydration, bundler, JSX/TSX failures |
| build-error-resolver | Build/type/lint/test diagnosis | General build, typecheck, lint, or test failures |
| silent-failure-hunter | False-success detection | Missing assertions, swallowed errors, fallback paths, fake green tests |

## Agent Orchestration

Use agents proactively without user prompt:

- Complex feature requests -> **planner**
- Code just written or modified -> **code-reviewer**
- Bug fix or new feature -> **tdd-guide**
- TypeScript / JavaScript changes -> **typescript-reviewer**
- React changes -> **react-reviewer**
- Vue changes -> **vue-reviewer**
- Build, typecheck, lint, or test failures -> **build-error-resolver** or a more specific resolver
- Critical browser flow changes -> **e2e-runner**
- Test coverage risk -> **pr-test-analyzer**
- Risk of false-positive success -> **silent-failure-hunter**

Use parallel execution for independent operations:

- `typescript-reviewer` + `react-reviewer` for TSX changes.
- `typescript-reviewer` + `vue-reviewer` for Vue + TypeScript changes.
- `pr-test-analyzer` + `silent-failure-hunter` after implementation.
- Build resolver + framework reviewer when a failure is framework-specific and reviewable.

## Development Workflow

1. **Plan** — Use planner agent, identify dependencies and risks, and break the work into phases.
2. **TDD** — Use tdd-guide agent, write tests first, implement minimally, and refactor while green.
3. **Review** — Use code-reviewer immediately, plus relevant language or framework reviewers.
4. **Diagnose** — Use resolver agents for build, typecheck, lint, or test failures; fix root causes incrementally.
5. **Verify** — Use test analysis, E2E, and silent-failure checks where relevant.
6. **Capture knowledge in the right place** — Store durable project knowledge in existing docs, specs, plans, or verification artifacts.

## Fallback Rules

- If the host cannot dispatch agents, say so explicitly and continue only with an inline fallback that preserves the same responsibilities.
- If a named agent is unavailable, record the missing agent and use the closest available reviewer or inline check.
- Never mark agent review, TDD guidance, E2E execution, or failure hunting as complete unless it actually ran.
- Do not invent agent outputs. Summaries must be based on real agent results or clearly labeled inline fallback work.
