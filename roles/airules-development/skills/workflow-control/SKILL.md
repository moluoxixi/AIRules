---
name: workflow-control
description: Operate the AIRules change-unit state machine and append-only evidence ledger. Use when starting, inspecting, advancing, blocking, replaying, or repairing a development change governed by the airules-development role.
---

# Control a change

Use the project-local runtime; never edit `change.json` or `evidence/events.jsonl` to advance state.

```text
node .airules/workflow/bin/workflow.mjs init <change>
node .airules/workflow/bin/workflow.mjs status <change>
node .airules/workflow/bin/workflow.mjs next <change>
node .airules/workflow/bin/workflow.mjs gate <change> <gate> --status <pass|fail> --evidence <ref> --idempotency-key <key>
node .airules/workflow/bin/workflow.mjs replay <change>
```

Follow the gate order returned by `next`. Every gate requires an evidence reference and a stable idempotency key. For failure, also pass `--failure-class <class>`; let the kernel select the default responsibility route unless an authorized policy explicitly requires `--route-to`.

Use `replay --repair` only when the append-only ledger is intact and the snapshot drift is mechanical. Never use repair to erase or rewrite an event.

If a repeated failure enters `blocked`, stop automated execution and request the missing decision or external-state change.
