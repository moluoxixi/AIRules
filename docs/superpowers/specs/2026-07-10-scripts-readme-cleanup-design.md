# Scripts and README Cleanup Design

## Goal

Remove repository-maintenance scripts and documentation that still assume role assets live in this repository. AIRules role skills, agents, hooks, and rules are supplied by remote synchronization as complete role paths.

## Scope

Delete obsolete standalone scripts whose only consumers are historical plans, dedicated npm aliases, or dedicated tests:

- `scripts/host-setup.ts`
- `scripts/verify-host.ts`
- `scripts/memory-health.ts`
- `scripts/review-candidates.ts`
- `scripts/verify-scenario-coverage.mjs`
- Their dedicated tests under `__test__/`

Remove the corresponding npm scripts and the obsolete `pretest` hook. Remove `presync` because running `npm run sync` must not implicitly mutate Git state or install package managers.

Keep:

- `scripts/cli.ts` as the supported user entry point.
- `scripts/check-rules-consistency.ts` as the repository consistency gate.
- `scripts/sync-vendors.ts`, `scripts/lib/vendor-lock.ts`, and `vendor-lock.json` because vendor lock refresh remains a distinct maintenance capability. Do not run vendor synchronization automatically before tests.
- `scripts/lib/vendor-staging.ts` and `scripts/lib/projection-state.ts`; these are recent remote-distribution modules awaiting CLI integration, not obsolete code.

## README

Rewrite both README files around the behavior that exists now:

- Present the `airules` CLI and its `sync`, `add`, and `verify` commands.
- State that first-party role assets are fetched remotely and synchronized as complete role paths.
- State that the default role value is empty; role selection is explicit.
- Remove claims that this checkout contains the OpenSpec, ECC, Spec Kit, Product, Trellis, or common role trees.
- Remove obsolete maintenance commands and the local `roles/` project tree.
- Keep descriptions of local user skills and vendor/host projection only where they match current code.

## Package Scripts

Remove entries tied to deleted scripts:

- `candidates:review`
- `memory:health`
- `verify:scenario-coverage`
- `pretest`
- `presync`

Keep `sync:update-lock`, but document that it is a maintenance command and must receive an explicit role once remote manifest integration supports it.

## Verification

The cleanup is complete when all of the following pass:

- `npm run rules:check`
- `npm run typecheck`
- `npm run build`
- `npm run lint:check`
- `npm test`
- `git diff --check`
- A repository-wide search finds no references to deleted scripts, deleted npm commands, `workflow-contract`, or local embedded role assets in README files.

No subagents are used for this change.
