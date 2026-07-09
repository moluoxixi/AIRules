# frontend-superpowers-bridge for Spec Kit

Project-local schema prompt asset installed only for frontend projects initialized by the AIRules `speckit-development` role.

## Source Basis

This asset is derived from the cloned `lihan3238/speckit-superpowers-bridge` repository, not from the OpenSpec schema assets.

- `.specify/templates/spec-template.md`
- `.specify/templates/plan-template.md`
- `.specify/templates/tasks-template.md`
- `.specify/extensions/speckit-superpowers-bridge/commands/speckit.speckit-superpowers-bridge.execute.md`
- `.specify/extensions/speckit-superpowers-bridge/commands/speckit.speckit-superpowers-bridge.handoff.md`

AIRules adds frontend field-contract, component-reuse, state, layout, and `frontend-testing` gates while preserving the Spec Kit feature flow: `spec.md` -> `plan.md` -> `tasks.md` -> bridge execution.

## Install Target

`spec-init.mjs` copies this directory to:

```text
.specify/airules-schemas/frontend-superpowers-bridge/
```

and writes:

```yaml
schema: frontend-superpowers-bridge
```

to `.specify/airules-schema.yaml`.

This is a Spec Kit project prompt schema asset. It is not an OpenSpec schema and does not write `openspec/**`.
