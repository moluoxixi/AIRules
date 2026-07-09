---
description: "Create or update the frontend Superpowers implementation handoff state"
---

# Superpowers Handoff

Create `.specify/superpowers-handoff.json` so Spec Kit artifacts explicitly hand implementation to Superpowers.

## Source Basis

Derived from the cloned `speckit-superpowers-bridge` command:

```text
.specify/extensions/speckit-superpowers-bridge/commands/speckit.speckit-superpowers-bridge.handoff.md
```

## Behavior

1. Resolve the active feature directory from `.specify/feature.json`.
2. Verify the feature has `spec.md`, `plan.md`, and `tasks.md`.
3. Verify frontend plan gates when `.specify/airules-schema.yaml` selects `frontend-superpowers-bridge`.
4. Write `.specify/superpowers-handoff.json` with feature directory, source of truth, superseded direct implementation command, executor, status, artifact owner, and review-only agents.
5. Tell the implementation agent to invoke the bridge.

## Frontend Blockers

Set status to `blocked` instead of `ready` when:

- `plan.md` lacks Layout, Fields, Components, States, or Frontend Test Matrix.
- Any UI-required field is marked `MISSING blocked: <reason>`.
- Component decisions are missing for UI units.
- Required frontend verification tooling is absent and no approved fallback is documented.

## Execution

Run this from the repository root. Use `.specify/init-options.json.script` to choose PowerShell or bash.

```powershell
.\.specify\extensions\speckit-superpowers-bridge\scripts\powershell\update-handoff.ps1 -Status ready
```

```bash
bash .specify/extensions/speckit-superpowers-bridge/scripts/bash/update-handoff.sh --status ready
```
