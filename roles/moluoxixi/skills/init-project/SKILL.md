---
name: init-project
description: Initialize or extend a project with the self-contained Moluoxixi workflow runtime and platform integrations distributed by the Moluoxixi AIRules role. Use when a user asks to initialize Moluoxixi, add Moluoxixi to a repository, configure Moluoxixi for one or more AI coding platforms, or replace `moluoxixi init`. Never install or invoke an upstream CLI.
---

# Initialize Project

Use the bundled AIRules initializer. Do not run `moluoxixi init`, `npx moluoxixi`, or install an upstream npm CLI.

## Workflow

1. Resolve the project root and confirm it is not a symlink.
2. Determine the requested platforms. Use the active host when the request is singular and unambiguous; otherwise ask which platforms to configure. Read [platforms.md](references/platforms.md) only when platform selection or output paths need clarification.
3. Optionally obtain a developer identifier. Detect project type and workspace packages (pnpm, npm/yarn/bun, Cargo, Go, uv, git submodules, and polyrepo layouts). Present detected package boundaries for review when the host interaction permits it; pass `--monorepo`, `--no-monorepo`, `--package <name=relative/path:type>`, `--default-package <name>`, and `--project-type <type>` to reproduce the approved choice explicitly. `--monorepo` must fail when no packages are detected; use explicit `--package` mappings instead of silently downgrading to a single project.
4. Run a dry run first:

   ```bash
   node "<skill-root>/scripts/init-project.mjs" --project "<project-root>" --platform "<comma-separated-platforms>" --dry-run
   ```

5. Review `conflicts`. Do not use `--force` unless the user explicitly authorizes replacement of conflicting managed files.
6. Run the same command without `--dry-run`. Add `--developer <name>` when identity initialization was requested, and `--with-statusline` only when the user wants the optional Claude Code status line.
7. Report created, updated, removed, restored, preserved, and conflicting paths. A process exit code of `2` means initialization completed for safe paths but conflicts were preserved.

For an explicitly requested workflow or spec template, preserve the upstream command semantics: use `--workflow <id> --workflow-source <source>` or `--template <id> --registry <source>`, with `--overwrite` or `--append` when requested. In a monorepo, the global template applies to every package; use repeated `--package-template <package=id>` and `--package-registry <package=source>` for reviewed package-specific choices. Registry strategies operate on each complete spec destination: `skip` leaves an existing directory untouched, `append` adds only missing files, and `overwrite` replaces files outside the downloaded template. The project runtime supports `workflow --list`, `workflow --template <id>`, `workflow --marketplace <source>`, `--force`, and `--create-new`.

When a project already contains an older Moluoxixi installation, review the dry-run migration list and pass `--migrate` for versioned renames/deletes. Modified migration sources receive an inline `.backup` by default; `--skip-all` preserves them and explicit `--force` migrates without the inline copy. Use `--allow-downgrade` only when intentionally applying an older template revision. Do not invoke an upstream CLI.

## Guarantees

- Keep every output inside the canonical project root and reject symlinked path segments.
- Refuse to initialize the exact user home unless `MOLUOXIXI_ALLOW_HOMEDIR=1` explicitly authorizes it.
- Preserve unknown files by default.
- Merge JSON configuration and managed instruction blocks without deleting unrelated user content.
- Preserve existing user JSON, YAML, TOML, instruction blocks, workspace journals, tasks, and specs when updating or uninstalling.
- Migrate legacy-named files, JSON entries, and managed blocks only when the manifest proves ownership; preserve user-modified legacy files as conflicts unless `--force` is explicit.
- Track only files or blocks actually owned by this initializer in `.moluoxixi/airules-init-manifest.json`.
- Keep uninstall confirmation (`-y` / `--yes`) separate from conflict replacement (`--force`).
- Roll back writes when any transactional write fails.
- Require Python 3.9+ because the migrated project runtime under `.moluoxixi/scripts` is Python.
- Keep upstream command coverage mapped to AIRules-owned equivalents; read [upstream-capability-map.md](references/upstream-capability-map.md) when auditing parity or changing an initializer surface.

Use `--platform all` only when the user explicitly wants every supported integration. Use `--python <command>` when the project environment requires a non-default Python executable.
