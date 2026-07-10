---
name: init-project
description: Initialize or refresh the AIRules single-mainline development workflow in a repository. Use when a project first adopts the airules-development role, when its project-local workflow runtime or OpenSpec schema is missing or outdated, or when the user explicitly asks to initialize the project.
---

# Initialize the project

Run the deterministic initializer from the project root:

```text
node <init-project-skill>/scripts/init-project.mjs <project-root>
```

The script owns only these surfaces:

- `.airules/workflow/`
- `openspec/schemas/airules-development/`
- the marked AIRules block inside project `AGENTS.md`
- missing `knowledge/{sessions,candidates,memory}/` directories

It preserves all content outside the marked block and is idempotent. Do not copy assets manually.

After initialization:

1. Confirm `openspec schema validate airules-development` passes.
2. Run `node .airules/workflow/bin/workflow.mjs --help`.
3. For an existing project, do not create a change until the user names or approves the first change unit.

Use `--no-verify` only in an isolated test where OpenSpec availability is intentionally outside scope. A real initialization must fail if schema validation cannot run.
