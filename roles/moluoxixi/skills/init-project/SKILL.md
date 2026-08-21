---
name: init-project
description: Initialize or extend a project with the Moluoxixi workflow and platform integrations from the published AIRules package. Use when a user asks to initialize Moluoxixi, add it to a repository, configure supported AI coding platforms, or replace `moluoxixi init`. Never install or invoke an upstream CLI.
---

# Initialize Project

Use the published `@moluoxixi/airules-moluoxixi` package. The skill is only an adapter: it does not carry templates, a runtime copy, or a second initializer implementation.

## Workflow

1. Resolve the project root and confirm it is not a symlink.
2. Determine the requested platforms. Use the active host when the request is singular and unambiguous; otherwise ask which platforms to configure. Supported values are `claude`, `cursor`, `opencode`, `codex`, `kilo`, `kiro`, `gemini`, `antigravity`, `devin`, `qoder`, `codebuddy`, `copilot`, `droid`, `dsh`, `pi`, `reasonix`, `zcode`, `trae`, `omp`, `grok`, `kimi`, and `snow`. `claude-code` aliases `claude`, `windsurf` aliases `devin`, and `all` means every supported platform.
3. Run the adapter. It invokes the published package CLI in the requested project directory. A globally installed `moluoxixi` command is used when available; otherwise the adapter uses an explicit `npx` package invocation:

   ```bash
   node "<skill-root>/scripts/run-role-cli.mjs" --project "<project-root>" --platform "<comma-separated-platforms>" --yes
   ```

4. Add `--user <name>` when developer identity initialization is requested. Add `--force` only when the user explicitly authorizes overwriting existing files; use `--skip-existing` to preserve them without prompting.
5. For an explicitly requested workflow or spec template, pass `--workflow <id> --workflow-source <source>` or `--template <id> --registry <source>`, with `--overwrite` or `--append` where requested.

The package CLI owns templates, platform configuration, version tracking, update, workflow, channel, memory, and uninstall behavior. Do not copy files from this skill into the target project, install the role workspace, build role-local sources, or invoke an upstream CLI. The adapter runs an installed `moluoxixi` binary when available and otherwise uses `npx --yes --package=@moluoxixi/airules-moluoxixi moluoxixi`.

The `.sync` workspace is local maintenance state and is never copied into a project.

## Guarantees

- Keep all package and project writes inside the resolved role or project root.
- Preserve user files by default and keep `--yes` separate from `--force`.
- Use the finalized package templates and the package CLI as the single implementation of initialization behavior.
- Never fetch, install, build, link, or publish the role workspace packages as part of project initialization.
