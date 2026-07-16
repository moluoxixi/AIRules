# Local Files Generated After Init

the `init-project` skill writes the Trellis runtime into the user project. Later, `node "<skill-root>/scripts/trellis.mjs" update` tries to update Trellis-managed template files, but it uses `.moluoxixi/airules-init-manifest.json` to determine which files have already been modified by the user.

This page only describes files that are visible and editable inside the user project.

## `.moluoxixi/`

```text
.moluoxixi/
├── workflow.md
├── config.yaml
├── .developer
├── .version
├── airules-init-manifest.json
├── .runtime/
├── runtime/
├── scripts/
├── spec/
├── tasks/
└── workspace/
```

| Path | Usually editable? | Notes |
| --- | --- | --- |
| `.moluoxixi/workflow.md` | Yes | Local workflow documentation and AI routing rules. |
| `.moluoxixi/config.yaml` | Yes | Project configuration, hooks, packages, journal line limits, and related settings. |
| `.moluoxixi/spec/` | Yes | Project specs, intended to be updated regularly by users and AI. |
| `.moluoxixi/tasks/` | Yes | Task material and research artifacts, maintained by the task workflow. |
| `.moluoxixi/workspace/` | Yes | Session records, usually written by `add_session.py`. |
| `.moluoxixi/scripts/` | Carefully | Local runtime. It can be customized, but only after understanding the call chain. |
| `.moluoxixi/runtime/` | No | AIRules-owned channel, memory, workflow, and updater runtime plus corresponding source. |
| `.moluoxixi/.runtime/` | No | Runtime state, usually written automatically by hooks/scripts. |
| `.moluoxixi/.developer` | Carefully | Current developer identity. |
| `.moluoxixi/.version` | No | Trellis version record used by update/migration logic. |
| `.moluoxixi/airules-init-manifest.json` | No | Template hash record. Do not hand-write business rules here. |

## Platform Directories

Different platforms generate different directories. Common categories:

| Category | Example paths | Purpose |
| --- | --- | --- |
| hooks | `.claude/hooks/`, `.codex/hooks/`, `.cursor/hooks/` | Inject session context, workflow-state, and sub-agent context. |
| settings | `.claude/settings.json`, `.codex/hooks.json`, `.qoder/settings.json` | Tell the platform when to run hooks or plugins. |
| agents | `.claude/agents/`, `.codex/agents/`, `.kiro/agents/`, `.zcode/cli/agents/` | Define agents such as `trellis-research`, `trellis-implement`, and `trellis-check`. |
| skills | `.claude/skills/`, `.agents/skills/`, `.qoder/skills/` | Skills that auto-trigger or can be read by AI. |
| commands/prompts/workflows | `.cursor/commands/`, `.github/prompts/`, `.devin/workflows/`, `.zcode/commands/` | Explicit user-invoked command or workflow entry points. |

When modifying a platform directory, also confirm whether `.moluoxixi/workflow.md` still describes the same flow.

## Meaning Of Template Hashes

`.moluoxixi/airules-init-manifest.json` records the content hash from the last time Trellis wrote a template file. `node "<skill-root>/scripts/trellis.mjs" update` uses it to distinguish three cases:

| Case | Update behavior |
| --- | --- |
| File was not modified by the user | It can be updated automatically. |
| File was modified by the user | Preserve it and report a conflict unless `--force` is explicit. |
| Unknown file | Preserve it and do not claim ownership. |

When an AI customizes local Trellis files, it does not need to maintain hashes manually. It is normal for Trellis update to recognize the result as "modified by the user."

## Local Customization Boundaries

Editable by default:

- `.moluoxixi/workflow.md`
- `.moluoxixi/config.yaml`
- `.moluoxixi/spec/**`
- `.moluoxixi/scripts/**`
- Platform hooks, settings, agents, skills, commands, prompts, and workflows

Do not edit by default:

- `.moluoxixi/runtime/**` executable and updater assets
- Concrete state files under `.moluoxixi/.runtime/**`
- Hash contents inside `.moluoxixi/airules-init-manifest.json`

Switch to the role-source perspective only when the user explicitly wants to change AIRules distribution behavior.
