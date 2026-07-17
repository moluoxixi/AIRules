# Trellis v0.6.7 Capability Map

Parity baseline: upstream revision `e7c5ead4d0dfd717d11a40b6bc0c80d8af94c49a`.

| Upstream surface | Moluoxixi surface |
| --- | --- |
| `init` and re-init | `init-project` skill plus `scripts/init-project.mjs`; supports 18 hosts, developer identity, reviewed monorepo package maps, dry-run, conflict preservation, force, and optional Claude statusline |
| `update` | `.moluoxixi/runtime/moluoxixi.mjs update`; uses the embedded initializer, exact baseline hashes, safe brand migration, JSON/block merging, and transactional rollback |
| `upgrade` | Global `airules sync --role moluoxixi`; project runtime never installs an npm CLI |
| `uninstall` | `.moluoxixi/runtime/moluoxixi.mjs uninstall`; manifest-owned files only, with dry-run and modified-file conflicts |
| `workflow` | Project runtime `workflow`; bundled native template or a human-reviewed local Markdown file, with missing-Agent warnings |
| `channel` | Project runtime `channel`; bundled local dispatcher and channel store |
| `mem` | Project runtime `mem`; bundled Claude, Codex, OpenCode, and Pi history adapters |
| Remote workflow/spec registries | Skill-mediated fetch to a temporary local path, human review, then local workflow install or user-owned spec merge |

## Host Contract

The initializer maintains native templates independently under `assets/hosts/<host>`. Shared skills, commands, and hooks live under `assets/shared` only when their source and behavior are host-neutral.

Pull-based implement/check Agents for Codex, Gemini, Qoder, Copilot, Pi, ZCode, and Trae receive an explicit active-task/context prelude. Copilot also receives native YAML tool-array frontmatter. Hook-based hosts retain their native hook or plugin context injection.

The supported host set is Claude, Cursor, OpenCode, Codex, Kilo, Kiro, Gemini, Antigravity, Devin, Qoder, CodeBuddy, GitHub Copilot, Factory Droid, Pi, Reasonix, ZCode, Trae, and OMP.

## Project Runtime Contract

The project receives workflow scripts, task lifecycle commands, workspace journals, package-aware specs, channel runtime Agents, managed host assets, and an embedded updater. Unknown files are never adopted. Modified owned files require explicit force, and knowledge-bearing external templates require human review before application.
