# AIRules change-unit workflow

Use `openspec/changes/<change>/` as the specification and evidence root. Use `.airules/workflow/bin/workflow.mjs` as the only state mutation entrypoint.

- Create a change before non-trivial implementation.
- Use `SCN-<capability>-<NNN>` scenario IDs and `covers: SCN-*` test mappings.
- Advance only through evidence-backed gates with stable idempotency keys.
- Classify failures before correction; stop when the kernel reports `blocked`.
- Keep run context, change memory, candidates, approved memory, and policy assets isolated.
- Do not let external frameworks create a parallel source of truth.
