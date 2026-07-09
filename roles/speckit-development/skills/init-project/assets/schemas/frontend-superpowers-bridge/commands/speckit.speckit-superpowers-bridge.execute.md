---
description: "Execute frontend Spec Kit tasks.md through the Superpowers bridge with AIRules projected skills"
---

# Bridge Execute

Execute the active Spec Kit feature through Superpowers without running `speckit.implement`.

## Source Basis

Derived from the cloned `speckit-superpowers-bridge` command:

```text
.specify/extensions/speckit-superpowers-bridge/commands/speckit.speckit-superpowers-bridge.execute.md
```

## Behavior

1. Read `.specify/superpowers-handoff.json`; if it is missing or stale, create a ready handoff with the platform-selected `update-handoff` script.
2. Read `.specify/memory/constitution.md`, `spec.md`, `plan.md`, and `tasks.md` before touching implementation files.
3. Confirm `plan.md` has Layout, Fields, Components, States, and Frontend Test Matrix sections.
4. Stop and set the handoff to `blocked` when any field row contains `MISSING blocked: <reason>`.
5. Run the bridge guard for `superpowers.executing-plans`.
6. Execute `tasks.md` with AIRules projected Superpowers skills: TDD, systematic debugging, review, verification, and branch finishing.
7. Keep task checkboxes and handoff state current.

## Frontend Execution Additions

- Use existing components/hooks/utilities/UI libraries before adding UI units.
- Do not implement UI-required fields absent from API/OpenAPI/interface/API client/store/route/permission/state/persistence/static/derived contracts.
- Follow `frontend-testing`: record commands, exit status, desktop/mobile viewport evidence, console/network checks, and screenshot or log paths when applicable.
- Use ECC frontend agents when available: planner, tdd-guide, pr-test-analyzer, e2e-runner, code-reviewer, typescript-reviewer, react-reviewer, vue-reviewer, react-build-resolver, build-error-resolver, silent-failure-hunter.

## Invocation

- Codex: `$speckit-superpowers-bridge`
- Claude Code: `/speckit-superpowers-bridge`

The canonical extension command remains available as a fallback:

- Codex: `$speckit-speckit-superpowers-bridge-execute`
- Claude Code: `/speckit-speckit-superpowers-bridge-execute`
