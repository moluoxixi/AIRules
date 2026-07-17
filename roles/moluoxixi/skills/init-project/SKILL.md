---
name: init-project
description: Initialize or extend a project with the self-contained Moluoxixi workflow runtime and platform integrations distributed by the Moluoxixi AIRules role. Use when a user asks to initialize Moluoxixi, add Moluoxixi to a repository, configure Moluoxixi for one or more AI coding platforms, or replace `moluoxixi init`. Never install or invoke an upstream CLI.
---

# Initialize Project

Use the bundled AIRules initializer. Do not run `moluoxixi init`, `npx moluoxixi`, or install an upstream npm CLI.

## Workflow

1. Resolve the project root and confirm it is not a symlink.
2. Determine the requested platforms. Use the active host when the request is singular and unambiguous; otherwise ask which platforms to configure. Read [platforms.md](references/platforms.md) only when platform selection or output paths need clarification.
3. Optionally obtain a developer identifier using only letters, digits, dots, underscores, or hyphens. For a monorepo, inspect package boundaries and types, present the proposed map for review, then add one `--package <name=relative/path:type>` per approved package and `--default-package <name>` when requested. Do not silently infer and persist package boundaries.
4. Run a dry run first:

   ```bash
   node "<skill-root>/scripts/init-project.mjs" --project "<project-root>" --platform "<comma-separated-platforms>" --dry-run
   ```

5. Review `conflicts`. Do not use `--force` unless the user explicitly authorizes replacement of conflicting managed files.
6. Run the same command without `--dry-run`. Add `--developer <name>` when identity initialization was requested, and `--with-statusline` only when the user wants the optional Claude Code status line.
7. Report created, updated, removed, preserved, and conflicting paths. A process exit code of `2` means initialization completed for safe paths but conflicts were preserved.

For an explicitly requested external workflow or spec template, fetch it to a temporary local path, show the relevant source and diff for human review, and only then apply it. Workflow files can be installed with the project runtime's `workflow --template <local-file>` command. External specs remain user-owned unless a reviewed package-specific projection is deliberately added; do not silently persist a remote registry.

## Guarantees

- Keep every output inside the canonical project root and reject symlinked path segments.
- Preserve unknown files by default.
- Merge JSON configuration and managed instruction blocks without deleting unrelated user content.
- Migrate legacy-named files, JSON entries, and managed blocks only when the manifest proves ownership; preserve user-modified legacy files as conflicts unless `--force` is explicit.
- Track only files or blocks actually owned by this initializer in `.moluoxixi/airules-init-manifest.json`.
- Roll back writes when any transactional write fails.
- Require Python 3.9+ because the migrated project runtime under `.moluoxixi/scripts` is Python.
- Keep upstream command coverage mapped to AIRules-owned equivalents; read [upstream-capability-map.md](references/upstream-capability-map.md) when auditing parity or changing an initializer surface.

Use `--platform all` only when the user explicitly wants every supported integration. Use `--python <command>` when the project environment requires a non-default Python executable.
