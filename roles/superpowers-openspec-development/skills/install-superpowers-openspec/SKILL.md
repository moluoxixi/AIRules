---
name: install-superpowers-openspec
description: Install and operate the role-pinned OpenSpec CLI alongside AIRules-distributed Superpowers skills, initialize a new OpenSpec ledger through isolated staging, and enforce a single execution boundary between specification and code delivery. Use when Codex needs to set up Superpowers plus OpenSpec, create or validate OpenSpec changes, inspect change status, obtain apply instructions, or diagnose the pinned toolchain without global plugins or target-side OpenSpec init/update.
---

# Install Superpowers and OpenSpec

Use Superpowers for execution discipline and OpenSpec for specification state. Do not let both systems execute the same change.

## Prepare the role

1. Resolve this skill directory as `<skill-root>`.
2. Read [upstream-lock.md](references/upstream-lock.md).
3. Confirm the role-projected Superpowers skills are present beside this skill as ordinary directories and files. Remove any same-name `~/.moluoxixi/local/skills` overrides before syncing; the wrapper rejects symlinked or out-of-root projections.
4. Run the toolchain preflight:

   ```bash
   node "<skill-root>/scripts/openspec.mjs" doctor
   ```

The preflight must succeed. If it reports missing Superpowers skills, stop and rerun `airules sync --host all --role superpowers-openspec-development`; do not continue with an OpenSpec-only installation.

## Install the pinned OpenSpec CLI

Run:

```bash
node "<skill-root>/scripts/openspec.mjs" install
```

The wrapper installs `@fission-ai/openspec@1.6.0` under the AIRules tool cache with the bundled dependency lock and `--ignore-scripts`. It never installs a global CLI or host plugin. It runs npm with isolated `HOME`, platform app-data directories, XDG directories, npm user configuration, and npm cache paths under the AIRules tool cache.

Installation and project-write locks contain an owner token. Treat an existing lock as live unless it is at least 30 minutes old, belongs to this host, and its PID is definitively absent. Never delete a live or unverifiable lock manually.

## Initialize a new ledger

Only initialize when `<project>/openspec` does not exist:

```bash
node "<skill-root>/scripts/openspec.mjs" init-ledger --project "<project>"
```

The wrapper runs the fixed CLI in an empty staging directory with `--tools none --profile core`, validates the generated ledger, and atomically moves only `openspec/` into the project. It never runs OpenSpec init or update directly against an unknown repository and never writes global prompts. Every OpenSpec child process uses the isolated user directories and disables upstream telemetry with `OPENSPEC_TELEMETRY=0` and `DO_NOT_TRACK=1`.

## Use the combined workflow

Maintain this ownership boundary:

- OpenSpec: proposal, specs, design, high-level tasks, status, synchronization, and archive state.
- Superpowers: detailed plan, worktree, TDD, implementation, debugging, review, and verification evidence.

Create and inspect changes through the wrapper:

```bash
node "<skill-root>/scripts/openspec.mjs" new-change --project "<project>" --name "<change-id>"
node "<skill-root>/scripts/openspec.mjs" status --project "<project>" --change "<change-id>"
node "<skill-root>/scripts/openspec.mjs" instructions-apply --project "<project>" --change "<change-id>"
node "<skill-root>/scripts/openspec.mjs" validate --project "<project>"
```

For other project-local OpenSpec commands, pass arguments without a shell through:

```bash
node "<skill-root>/scripts/openspec.mjs" run --project "<project>" -- <openspec arguments>
```

The escape hatch accepts only `list`, `show`, `status`, `instructions`, `validate`, `templates`, `schemas`, `new change`, `sync`, and `archive`, with an optional leading `--no-color`. It rejects every other command, including `init`, `update`, `completion`, `install`, `uninstall`, `config`, and `store`. It serializes `new change`, `sync`, and `archive` through one project-write lock; read-only commands do not take that lock.

Write the OpenSpec change ID into the Superpowers plan. Treat `instructions-apply` as specification input only; use one Superpowers execution path for code changes. Finish with strict OpenSpec validation, project tests, and optional agentic spec/code review.

## Prevent conflicts

- Do not install the native Superpowers plugin with this role.
- Do not invoke OpenSpec `apply` as an execution agent.
- Do not run target-side `openspec init`, `openspec update`, or global prompt generation.
- Override upstream suggestions to inspect recent commits or commit designs: use current OpenSpec artifacts and the working tree, and do not read repository history.
- Never delete `openspec/specs` or archived changes when switching roles.
