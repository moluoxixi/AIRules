# Local Files Generated After Init

`moluoxixi init` writes the Moluoxixi runtime into the user project. Later, `moluoxixi update` tries to update Moluoxixi-managed template files, but it uses `.moluoxixi/.template-hashes.json` to determine which files have already been modified by the user.

This page only describes files that are visible and editable inside the user project.

## `.moluoxixi/`

```text
.moluoxixi/
├── workflow.md
├── config.yaml
├── .developer
├── .version
├── .template-hashes.json
├── .runtime/
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
| `.moluoxixi/.runtime/` | No | Runtime state, usually written automatically by hooks/scripts. |
| `.moluoxixi/.developer` | Carefully | Current developer identity. |
| `.moluoxixi/.version` | No | Moluoxixi version record used by update/migration logic. |
| `.moluoxixi/.template-hashes.json` | No | Template hash record. Do not hand-write business rules here. |

## Platform Directories

Different platforms generate different directories. Common categories:

| Category | Example paths | Purpose |
| --- | --- | --- |
| hooks | `.claude/hooks/`, `.codex/hooks/`, `.cursor/hooks/` | Inject session context, workflow-state, and sub-agent context. |
| settings | `.claude/settings.json`, `.codex/hooks.json`, `.qoder/settings.json`, `.trae/hooks.json` | Tell the platform when to run hooks or plugins. |
| agents | `.claude/agents/`, `.codex/agents/`, `.kiro/agents/`, `.zcode/agents/` | Define agents such as `moluoxixi-research`, `moluoxixi-implement`, and `moluoxixi-check`. |
| skills | `.claude/skills/`, `.agents/skills/`, `.qoder/skills/`, `.zcode/skills/` | Skills that auto-trigger or can be read by AI. |
| commands/prompts/workflows | `.cursor/commands/`, `.github/prompts/`, `.devin/workflows/`, `.zcode/commands/` | Explicit user-invoked command or workflow entry points. |

When modifying a platform directory, also confirm whether `.moluoxixi/workflow.md` still describes the same flow.

## Meaning Of Template Hashes

`.moluoxixi/.template-hashes.json` records the content hash from the last time Moluoxixi wrote a template file. `moluoxixi update` uses it to distinguish three cases:

| Case | Update behavior |
| --- | --- |
| File was not modified by the user | It can be updated automatically. |
| File was modified by the user | Prompt the user to overwrite, keep, or generate `.new`. |
| File is no longer a current template | It may be deleted, renamed, or preserved according to migration rules. |

When an AI customizes local Moluoxixi files, it does not need to maintain hashes manually. It is normal for Moluoxixi update to recognize the result as "modified by the user."

## Local Customization Boundaries

Editable by default:

- `.moluoxixi/workflow.md`
- `.moluoxixi/config.yaml`
- `.moluoxixi/spec/**`
- `.moluoxixi/scripts/**`
- Platform hooks, settings, agents, skills, commands, prompts, and workflows

Do not edit by default:

- Global npm install directory
- `node_modules/@moluoxixi/airules-moluoxixi`
- Moluoxixi GitHub repository source code
- Concrete state files under `.moluoxixi/.runtime/**`
- Hash contents inside `.moluoxixi/.template-hashes.json`

Switch to the Moluoxixi CLI source-code perspective only when the user explicitly wants to contribute upstream.
