---
name: install-trellis
description: Install and initialize the role-pinned Trellis CLI with a locked local tool cache, explicit AGPL acceptance, deterministic platform and monorepo choices, and non-destructive update checks. Use when Codex needs to install Trellis 0.6.6, initialize Trellis in a new project, diagnose prerequisites, inspect project drift, or prepare a safe Trellis update without using latest, global npm installation, or force flags.
---

# Install Trellis

Use the bundled wrapper for every Trellis command. Never substitute a global `trellis` binary.

## Prepare

1. Resolve this skill directory as `<skill-root>`.
2. Read [upstream-lock.md](references/upstream-lock.md) before installation.
3. Confirm Node.js `>=18.17.0` and Python `>=3.9` with:

   ```bash
   node "<skill-root>/scripts/trellis.mjs" doctor
   ```

4. Obtain explicit user acceptance of `AGPL-3.0-only`. Do not infer acceptance from role selection.

## Install the pinned tool

Run:

```bash
node "<skill-root>/scripts/trellis.mjs" install --accept-agpl-3.0-only
```

The wrapper validates the bundled lock, uses `npm ci --ignore-scripts`, installs only under the AIRules versioned tool cache, and verifies that the CLI reports `0.6.6`. It runs npm and the pinned CLI with isolated `HOME`, `APPDATA`, XDG, Codex, Claude, npm-cache, and temporary directories. It does not modify the project, write real user configuration, or install a global package.

## Initialize a new project

Before initialization, obtain all of:

- absolute project path;
- safe developer ID;
- one or more explicit platforms from `codex`, `claude`, or `cursor`;
- explicit `yes` or `no` monorepo choice.

Then run:

```bash
node "<skill-root>/scripts/trellis.mjs" init \
  --project "<project>" \
  --developer "<developer-id>" \
  --platform "codex" \
  --monorepo "no"
```

The wrapper refuses an existing `.trellis/`, uses the native workflow, and never passes `--force`. It snapshots `.trellis/`, `AGENTS.md`, `.gitignore`, and the selected platform roots before invoking upstream. Any command failure, Git invocation, or postcondition failure restores the snapshot so a retry is not blocked by partial files. Refuse symbolic links in those roots because they cannot be rolled back safely.

Initialization denies every Git invocation and fails if upstream attempts one. This mechanically prevents initialization from creating a Git commit; do not weaken or bypass the Git guard.

Verify the selected platform artifacts explicitly:

```bash
node "<skill-root>/scripts/trellis.mjs" verify-project \
  --project "<project>" \
  --platform "codex"
```

Require these representative files in addition to `.trellis/.developer`, `.trellis/.version`, `.trellis/config.yaml`, `.trellis/workflow.md`, `.trellis/scripts/task.py`, the bootstrap task, and `AGENTS.md`:

| Platform | Required integration artifacts |
| --- | --- |
| Codex | `.agents/skills/trellis-before-dev/SKILL.md`, `.agents/skills/trellis-meta/SKILL.md`, `.codex/agents/trellis-{implement,check,research}.toml`, `.codex/config.toml`, `.codex/hooks.json`, `.codex/hooks/inject-workflow-state.py` |
| Claude | `.claude/agents/trellis-{implement,check,research}.md`, `.claude/commands/trellis/{continue,finish-work}.md`, `.claude/hooks/{session-start,inject-workflow-state,inject-subagent-context}.py`, `.claude/settings.json`, `.claude/skills/trellis-before-dev/SKILL.md` |
| Cursor | `.cursor/agents/trellis-{implement,check,research}.md`, `.cursor/commands/trellis-{continue,finish-work}.md`, `.cursor/hooks/{session-start,inject-shell-session-context,inject-subagent-context}.py`, `.cursor/hooks.json`, `.cursor/skills/trellis-before-dev/SKILL.md` |

After verification, run:

```bash
node "<skill-root>/scripts/trellis.mjs" update-dry-run --project "<project>"
```

## Audit and enable Codex hooks

Treat project file installation and hook trust as separate gates. Never edit user configuration or approve hooks automatically.

1. Require current Codex hook support (`>=0.129`). Do not configure a legacy compatibility flag.
2. Read `.codex/hooks.json` and every referenced script. Confirm the event is the intended `UserPromptSubmit` integration, each command resolves inside `<project>/.codex/hooks/`, and the scripts contain no unapproved network, credential, package-install, or Git operation.
3. Ask the user to set `features.hooks = true` in their user `~/.codex/config.toml` only after the audit. Do not make this user-level change for them.
4. Start a new Codex session, run `/hooks`, inspect the displayed command and event again, and let the user approve the Trellis hook manually.
5. Submit a harmless prompt and confirm the Trellis workflow breadcrumb appears. If it does not, keep the hook untrusted or disable `features.hooks` until the mismatch is understood.

## Handle an existing installation

- Run `update-dry-run`; do not run `init` again.
- Classify the result as **clean** only when the command exits `0`, reports project and CLI version `0.6.6`, prints `Already up to date!`, and reports no migration, incomplete migration, conflict, modified managed file, or create/update/delete plan.
- Classify every other result as **review required**, including exit `0` with `[Dry run] No changes made.` after a change plan. Surface the complete paths and actions. Do not apply, migrate, force, or uninstall until the user reviews the ownership conflict and separately authorizes a backed-up action.
- Do not run `trellis upgrade`, `--allow-downgrade`, or `--force`.
- Do not call upstream uninstall automatically. It can recursively remove `.trellis/` runtime state.
- Keep Trellis as the sole owner of the project integration files and native hooks it creates.

## Enforce completion checks

Require all of:

- cached CLI version is exactly `0.6.6`;
- project `.trellis/.version` exists after initialization;
- `verify-project` passes for every selected platform;
- `update-dry-run` meets the exact clean standard above, or is reported as review required without applying changes;
- no global package, AIRules hook, real user-directory write, trust setting, Git invocation, or commit was created by this skill.
