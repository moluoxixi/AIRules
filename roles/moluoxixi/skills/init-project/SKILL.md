---
name: init-project
description: Initialize or extend a project with the self-contained Trellis workflow runtime and platform integrations distributed by the Moluoxixi AIRules role. Use when a user asks to initialize Trellis, add Trellis to a repository, configure Trellis for one or more AI coding platforms, or replace `trellis init`. Never install or invoke the upstream Trellis CLI.
---

# Initialize Project

Use the bundled AIRules initializer. Do not run `trellis init`, `npx trellis`, or install `@mindfoldhq/trellis`.

## Workflow

1. Resolve the project root and confirm it is not a symlink.
2. Determine the requested platforms. Use the active host when the request is singular and unambiguous; otherwise ask which platforms to configure. Read [platforms.md](references/platforms.md) only when platform selection or output paths need clarification.
3. Optionally obtain a developer identifier using only letters, digits, dots, underscores, or hyphens.
4. Run a dry run first:

   ```bash
   node "<skill-root>/scripts/init-project.mjs" --project "<project-root>" --platform "<comma-separated-platforms>" --dry-run
   ```

5. Review `conflicts`. Do not use `--force` unless the user explicitly authorizes replacement of conflicting managed files.
6. Run the same command without `--dry-run`. Add `--developer <name>` when identity initialization was requested.
7. Report created, updated, preserved, and conflicting paths. A process exit code of `2` means initialization completed for safe paths but conflicts were preserved.

## Guarantees

- Keep every output inside the canonical project root and reject symlinked path segments.
- Preserve unknown files by default.
- Merge JSON configuration and managed instruction blocks without deleting unrelated user content.
- Track only files or blocks actually owned by this initializer in `.moluoxixi/airules-init-manifest.json`.
- Roll back writes when any transactional write fails.
- Require Python 3.9+ because the migrated project runtime under `.moluoxixi/scripts` is Python.

Use `--platform all` only when the user explicitly wants every supported integration. Use `--python <command>` when the project environment requires a non-default Python executable.
