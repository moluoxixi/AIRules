---
name: init-project
description: Initialize or reconfigure a repository with official native Trellis project assets by running the installed Trellis CLI. Use when a user asks to initialize Trellis, install Trellis into a project, add Trellis support for coding platforms, or run the project-level step after installing the AIRules trellis role.
---

# Initialize Native Trellis

Run the official `trellis init` command in the target project. Trellis owns every native generated project asset; do not copy, rename, or recreate those assets from AIRules. AIRules owns only the managed Trellis usage block injected into the project `README.md` after native initialization succeeds.

## Workflow

1. Resolve the intended project root. Prefer the repository root when the request refers to the current repository. If the location is ambiguous, ask the user. Never initialize the user home directory.
2. Inspect `git status --short` and whether `.trellis` already exists. Preserve unrelated work. If Trellis is already initialized, explain that the command will reconfigure or update it and obtain confirmation unless the user explicitly requested that operation.
3. Verify `trellis --version` succeeds. If it does not, stop and tell the user to install this role with:

   ```bash
   airules sync --host all --role trellis
   ```

4. Obtain the developer identifier used by Trellis. Use a value supplied or confirmed by the user; never silently invent one. A detected Git user name may be offered as a suggestion, but requires confirmation.
5. Run `trellis init --help` from the installed version before constructing platform arguments. When the user selects platforms, use only the corresponding native flags shown by that help output. Do not pass AIRules host names through an invented generic option.
6. Show the resolved project root and exact command before execution. An explicit request to initialize that root is sufficient approval; otherwise ask for confirmation.
7. Execute the native command with the project root as the working directory:

   ```bash
   trellis init <confirmed-platform-flags> -u <confirmed-developer>
   ```

   If the user intentionally wants Trellis's native default or interactive platform selection, omit platform flags instead of guessing them.

8. After `trellis init` succeeds, inject or update the Chinese Trellis usage block without replacing existing project documentation:

   ```bash
   node "<skill-root>/scripts/inject-readme.mjs" --project "<project-root>"
   ```

   Exit code `2` means `README.md` was preserved because its encoding, type, or managed markers are unsafe to modify. Report that conflict without retrying with an overwrite.
9. Report the Trellis CLI and README injection results, then summarize changed paths using `git status --short`. Do not stage or commit generated files unless the user explicitly requests it.

## Native Boundary

- Use the CLI installed by the `trellis` role. Do not install a second copy with `npx` or a project dependency.
- Let the installed CLI define supported platforms and output paths. Do not hard-code a stale platform catalog.
- Do not translate `.trellis`, commands, skills, agents, hooks, or other generated assets into Moluoxixi equivalents.
- Keep the AIRules-owned `README.md` block separate from Trellis-native assets; preserve all content outside its markers.
- Propagate CLI failures without masking them or claiming partial initialization succeeded.
