---
name: init-project
description: Initialize or extend a project with the Moluoxixi workflow runtime and supported AI coding platform integrations. Use after installing the Moluoxixi AIRules role, when adding Moluoxixi to a repository, or when replacing a direct `moluoxixi init` invocation.
---

# Initialize Moluoxixi

`airules install moluoxixi` installs `@moluoxixi/airules-moluoxixi-cli@latest` globally. That CLI has an exact dependency on `@moluoxixi/airules-moluoxixi-core`, so npm installs the core package with it. The core package is an SDK without a `bin` or project templates; the CLI owns project initialization.

## Procedure

1. Resolve the project root and confirm the resolved directory is not a symlink.
2. Determine the requested platforms. Use the active host when the request is singular and unambiguous; otherwise ask which platforms to configure. Supported values are `claude`, `cursor`, `opencode`, `codex`, `kilo`, `kiro`, `gemini`, `antigravity`, `devin`, `qoder`, `codebuddy`, `copilot`, `droid`, `dsh`, `pi`, `reasonix`, `zcode`, `trae`, `omp`, `grok`, `kimi`, and `snow`. `claude-code` aliases `claude`, `windsurf` aliases `devin`, and `all` selects every supported platform.
3. Run the adapter from this skill directory:

   ```bash
   node "<skill-root>/scripts/run-role-cli.mjs" --project "<project-root>" --platform "<comma-separated-platforms>" --yes
   ```

   The adapter uses the installed `moluoxixi` command. If it is unavailable, it runs this published-package fallback:

   ```bash
   npx --yes --package=@moluoxixi/airules-moluoxixi-cli moluoxixi init
   ```

4. Add `--user <name>` when developer identity initialization is requested. Add `--force` only with explicit authorization to overwrite files; use `--skip-existing` to preserve existing files without prompting.
5. For an explicitly requested workflow or spec template, pass `--workflow <id> --workflow-source <source>` or `--template <id> --registry <source>`, together with `--overwrite` or `--append` when requested.
6. Confirm the command exits successfully, `.moluoxixi/workflow.md` exists, and each requested platform integration was created. Report preserved or skipped files.

For direct CLI use after role installation, run `moluoxixi init --<platform> --yes` from the target project. Install `@moluoxixi/airules-moluoxixi-core` in a project's dependencies only when project code imports its SDK exports; installing core alone does not initialize Moluoxixi.

The package CLI is the single implementation for templates, platform configuration, version tracking, update, workflow, channel, memory, and uninstall behavior. Keep package and project writes inside the resolved role or project root. The `.sync` maintenance workspace is never copied into a project.
