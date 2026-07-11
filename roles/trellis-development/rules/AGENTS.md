# Trellis installation role

- Use `install-trellis` for every Trellis installation or project initialization.
- Install only the role-pinned Trellis release. Never run `trellis upgrade`, request `latest`, or bypass package-lock integrity.
- Require explicit AGPL-3.0-only acceptance before installing the tool cache.
- Before initialization, require an explicit developer ID, target platform, and monorepo choice. Never infer identity from Git configuration.
- Do not initialize over an existing `.trellis/`; use the dry-run update path and surface migrations or conflicts.
- Trellis owns the project files and native hooks it generates. This role declares no AIRules hook and must not double-install an upstream Trellis plugin.
- Never use `--force`, `--allow-downgrade`, or destructive uninstall by default. Do not delete `.trellis/`, tasks, journals, or runtime state without separate explicit authorization and a backup.
- Do not read repository history or create commits unless the user separately requests it.
