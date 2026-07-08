# frontend-superpowers-bridge Schema

Frontend-focused OpenSpec schema derived from `superpowers-bridge`.

Use this schema for pure frontend projects, or for full-stack changes whose main risk is UI fields, components, state, routes, permissions, interactions, or browser behavior. Use the original `superpowers-bridge` for non-frontend changes.

## What This Adds

This schema keeps the upstream bridge lifecycle:

```text
brainstorm -> proposal -> design -> specs -> tasks -> plan -> apply -> verify -> retrospective
```

It adds frontend gates to the existing Superpowers-driven execution flow:

- `design.md` must include `Layout`, `Fields`, `Components`, `States`, and `Frontend Test Matrix`.
- Every UI field must map to a source contract: `API`, `OpenAPI`, `interface code`, `API client`, `store`, `route params`, `permission`, `state`, `persistence`, `static`, or `derived`.
- Missing UI-required fields must be written as `MISSING blocked: <reason>` and block implementation.
- Every UI unit must be classified as `existing`, `wrap existing`, or `new`.
- `plan.md` must preserve the frontend gates while decomposing work into TDD micro-steps.
- `verify.md` must record frontend evidence: commands, exit status, desktop/mobile coverage, console/network checks, and screenshots/logs where applicable.
- Apply must bridge to the ECC execution agents listed below when the platform supports agents.

## ECC Execution Agent Bridge

`frontend-superpowers-bridge` expects the adopter role to expose these ECC agents for frontend execution:

| Agent | Use |
|---|---|
| `planner` | Produce implementation plans for complex frontend features, refactors, and multi-step changes |
| `tdd-guide` | Enforce RED-GREEN-REFACTOR implementation steps |
| `pr-test-analyzer` | Check changed frontend surfaces against the test matrix |
| `e2e-runner` | Run or coordinate browser/E2E validation |
| `code-reviewer` | Perform general implementation review |
| `typescript-reviewer` | Review TypeScript types, contracts, and compile-time safety |
| `react-reviewer` | Review React components, hooks, state, and rendering behavior |
| `vue-reviewer` | Review Vue components, composables, state, and rendering behavior |
| `react-build-resolver` | Diagnose React build failures |
| `build-error-resolver` | Diagnose general build/type/lint/test failures |
| `silent-failure-hunter` | Hunt missing assertions, swallowed errors, and false-positive success paths |

If these agents are unavailable, apply must stop or fall back only with explicit user approval and a recorded `NOT RUN automated: <reason>` / `MISSING blocked: <reason>` entry in `verify.md`.

## Routing

| Change Type | Schema |
|---|---|
| Pure frontend project feature | `frontend-superpowers-bridge` |
| Full-stack change focused on UI/page/component/state/permission/browser behavior | `frontend-superpowers-bridge` |
| Backend/API/CLI/infrastructure/docs-only change | `superpowers-bridge` |
| Small bug fix, typo, config tweak, non-contract test backfill | Direct PR, no schema ceremony |

Example:

```bash
/opsx:new user-profile-page --schema frontend-superpowers-bridge
/opsx:new payment-webhook --schema superpowers-bridge
```

## Frontend Field Gate

The `design.md` Fields table is the source of truth for UI field planning.

Required columns:

| Area | Field Name | UI Purpose | Source Type | Source Path / Endpoint | Exists? | Missing Status | Component Decision | Component Path | Display Shape | Permission Control | State Coverage | Test Point |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

Rules:

- Source Type must be one of the schema enum values.
- Missing Status must be `OK` or `MISSING blocked: <reason>`.
- `MISSING blocked:` means stop before implementation.
- Do not continue with mock fields, guessed defaults, empty fallbacks, or "fill later".

## Component Gate

Before creating a component, search existing project components, hooks/composables, utilities, and installed UI libraries.

Every UI unit must be classified:

- `existing`: reuse as-is.
- `wrap existing`: wrap to satisfy fields, state, permission, async, error, accessibility, or responsive requirements.
- `new`: create only when reuse/wrap cannot satisfy the contract.

Wrap/new decisions must document inputs, outputs/events, dependent fields, covered states, accessibility notes, and reuse scope.

## Test Gate

Frontend verification follows the `frontend-testing` discipline:

| Dimension | Required Evidence |
|---|---|
| Page / Route | entry, exit, navigation, refresh, deep link, permission redirect |
| Fields | source, display shape, formatting, empty value, API presence |
| Components | reuse/new decision and state coverage |
| State | loading, empty, error, disabled, success, permission-denied, pending |
| Interaction | click, input, submit, cancel, retry, pagination, filter, sort |
| Responsive | desktop and mobile viewport; tablet for dense pages |
| Observable Errors | console error, network error, request status, exception message |
| Regression Evidence | unit/component/integration/E2E/browser/visual output |

If the project lacks automated frontend tooling, write `MISSING blocked: no frontend test runner` or `NOT RUN automated: <reason>`. Do not mark guessed or manual-only coverage as PASS.

## Maintenance

Keep `superpowers-bridge/` close to upstream. Put frontend-specific changes in this derived schema so upstream bridge updates remain easy to compare and rebase.
