---
name: init-project
description: Initialize or reconfigure a repository with official native Trellis project assets, then install the AIRules-owned knowledge workflow and temporary Simplified Chinese task conventions. Use when a user asks to initialize Trellis, install Trellis into a project, add Trellis support for coding platforms, or run the project-level step after installing the AIRules trellis role.
---

# Initialize Native Trellis

Run the role-local wrapper so the official `trellis init` completes before the
AIRules extension is installed. Trellis owns its native generated project
assets. AIRules owns only the knowledge workflow, managed project instruction
block, and README usage block installed after native initialization succeeds.

## Workflow

1. Resolve the intended project root. Prefer the repository root when the
   request refers to the current repository. If the location is ambiguous, ask
   the user. Never initialize the user home directory.
2. Inspect `git status --short` and whether `.trellis` already exists. Preserve
   unrelated work. If Trellis is already initialized, explain that the command
   will reconfigure or update it and obtain confirmation unless the user
   explicitly requested that operation.
3. Verify `trellis --version` succeeds. If it does not, stop and tell the user
   to install this role with:

   ```bash
   airules install trellis --host all
   ```

4. Obtain the developer identifier used by Trellis. Use a value supplied or
   confirmed by the user; never silently invent one. A detected Git user name
   may be offered as a suggestion, but requires confirmation.
5. Run `trellis init --help` from the installed version. Confirm each requested
   platform is supported by that version. Pass platforms to the wrapper with
   repeatable `--platform` options; use `claude` for Trellis's `--claude` flag.
6. Show the resolved project root and exact wrapper command before execution.
   An explicit request to initialize that root is sufficient approval;
   otherwise ask for confirmation.
7. Execute from any directory using the absolute Skill path:

   ```bash
   node "<skill-root>/scripts/run-role-cli.mjs" --project "<project-root>" --platform <platform> --developer <confirmed-developer> <confirmed-native-options>
   ```

   The wrapper runs `trellis init` in the project root, localizes a newly
   generated default bootstrap task, then installs the knowledge workflow and
   README block. It requires at least one platform so the knowledge Skill and
   supported Hook can be projected to the right host.
8. Treat exit code `2` as an AIRules managed-file or README conflict. Preserve
   the affected user file and report it; do not retry with `--force` unless the
   user explicitly authorizes overwriting the managed portion. Propagate every
   other CLI failure without claiming initialization succeeded.
9. Report the native Trellis and AIRules extension results. Point out
   `.trellis/knowledge/sources/` as the document inbox and summarize changed
   paths using `git status --short`. Do not stage or commit generated files
   unless the user explicitly requests it.

## Native Boundary

- Use the CLI installed by the `trellis` role. Do not install a second copy
  with `npx` or a project dependency.
- Let the installed CLI own `.trellis` workflow, commands, skills, agents, and
  native hooks. AIRules only localizes the default bootstrap task created during
  first initialization; it preserves pre-existing or customized task content.
- Keep AIRules assets under this role-local Skill. Never depend on another role
  or modify an upstream Trellis package during project initialization.
- Preserve `.trellis/knowledge/index.md`, `sources/`, `library/`, and
  `.state.json` across re-initialization and `--force`.
- The temporary Simplified Chinese task convention is isolated between
  `AIRULES:TRELLIS-ZH-COMPAT` markers in the managed `AGENTS.md` block. Remove
  only that inner block after upstream Trellis provides equivalent localization.
