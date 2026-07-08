# Moluoxixi AIRules

> 🧩 Build your own AI coding best practices by composing modular skills — like LEGO bricks.

**English** | **[中文](README-zh.md)**

## What is this?

AIRules is a **composable AI skill distribution system**. The core idea is simple:

- **Clone** curated AI Skills from mature community sources (Anthropic, Google Gemini, OpenAI, PM Skills, etc.)
- **Write** your own domain-specific Skills
- **Compose** these small, modular units into your personalized development best practices
- **Distribute** them to your AI agents (Claude, Cursor, Codex, Trae, Qoder, OpenCode, etc.) with one command

## Core Philosophy

### 🏗️ Three-Layer Architecture

```
┌─────────────────────────────────────────────┐
│  🔧 First-Party Skills (your own)           │ ← Your competitive edge
│  init-project / handoff / memory / PM skills │
├─────────────────────────────────────────────┤
│  📦 Third-Party Skills (cloned from mature  │ ← Stand on the shoulders
│  repos) gemini/review · anthropic/design ·  │   of giants
│  openai/playwright · pm-skills · ...         │
├─────────────────────────────────────────────┤
│  🚀 Distribution Engine (one-command deploy │ ← Automated infrastructure
│  to supported AI agents)                    │
└─────────────────────────────────────────────┘
```

### 📐 Design Principles

| Principle | Description |
|-----------|-------------|
| **Small, Modular Units** | Each skill does one thing — independent, testable, replaceable |
| **Composition > Monolith** | Like Unix pipes — combine small tools to solve big problems |
| **Capability First** | Install workflow, tool, design, and verification skills by default; generate code standards from the current repository |
| **Self-Healing Distribution** | One command syncs to configured agents with auto link repair and verification |

## What You Get

- 🔥 **Curated** workflow, tool, design, and verification AI Skills out of the box
- 🧠 **Automatic CodeGraph, OpenSpec, BMAD, and gstack install** via the default development role; Spec Kit bridge and ECC stay available through explicit roles
- 🧱 **Reserved first-party expansion slots** so you can add your own top-level skills later without changing the distribution model
- 🌐 **Multi-agent sync**: configure once, works across Claude / Cursor / Codex / Hermes / Qoder / Trae / OpenCode / CC-Switch and the `.agents` shared layer
- 🔄 **Continuous updates**: one command pulls latest upstream skills

## Installation

**Use as a Node CLI (local development / npm link):**

```bash
npm install -g pnpm
pnpm install
pnpm build
npm link
airules sync --host all
```

Add a local skill and sync it to every host:

```bash
airules add ./my-skill --host all
```

The `add` command requires the source directory to contain `SKILL.md`. It copies the skill to `~/.moluoxixi/local/skills/<skill-name>` and then uses the same vendor/host projection pipeline.

**macOS / Linux / Git Bash:**

```bash
git clone https://github.com/moluoxixi/AIRules.git "$HOME/.moluoxixi"
cd "$HOME/.moluoxixi"
npm run sync
```

**Windows CMD:**

```cmd
git clone https://github.com/moluoxixi/AIRules.git "%USERPROFILE%\.moluoxixi"
cd "%USERPROFILE%\.moluoxixi"
npm run sync
```

**Windows PowerShell:**

```powershell
git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\.moluoxixi"
cd "$env:USERPROFILE\.moluoxixi"
npm run sync
```

> [!TIP]
> **Sync Process**: `npm run sync` is the default ECC development sync (`roles/common` + `roles/ecc-development`). `npm run sync:ecc-development` is the explicit alias for the same role. Use `npm run sync:development` or `npm run sync:openspec-development` for the OpenSpec + BMAD + gstack role, `npm run sync:speckit-development` for the optional Spec Kit + Superpowers bridge role, or `npm run sync:product` for the product role (`roles/common` + `roles/product`). Each sync rebuilds vendor skills, runs setup commands, cleans dead links, and runs host verification after AIRules projection. The default ECC setup uses ECC official installers for native global targets and AIRules fallback projection for Qoder, Trae, and Trae CN. Use `airules sync --skip-vendors` when you do not want to refresh third-party vendor repositories, run setup, or invoke ECC official installers.

---

## Specific Host Installation

**macOS / Linux / Git Bash:**

```bash
git clone https://github.com/moluoxixi/AIRules.git "$HOME/.moluoxixi"
cd "$HOME/.moluoxixi"
npm run rules:install -- --host claude
```

**Windows CMD:**

```cmd
git clone https://github.com/moluoxixi/AIRules.git "%USERPROFILE%\.moluoxixi"
cd "%USERPROFILE%\.moluoxixi"
npm run rules:install -- --host claude
```

**Windows PowerShell:**

```powershell
git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\.moluoxixi"
cd "$env:USERPROFILE\.moluoxixi"
npm run rules:install -- --host claude
```

> [!TIP]
> Inside the cloned repository, `npm run rules:install -- --host claude` still works and now forwards to `airules sync`.

---

## Default ECC Workflow

The default development role is `ecc-development`. It uses ECC as the primary orchestration source, keeps AIRules common session capture / memory / reflection assets layered in, and uses audited fallback projection for hosts that do not have an ECC native target. This is the default personal / ECC-native workflow.

### Explicit OpenSpec Role

Use `openspec-development` when a project needs OpenSpec as the durable specification and change lifecycle. Superpowers, BMAD, and gstack act as execution, product-planning, review, and shipping modules around that source of truth. Initialize target projects with the OpenSpec `init-project` skill, then use the OpenSpec lifecycle commands:

```text
/opsx:propose "<feature-or-bug>"
/opsx:apply <change-id>
/opsx:archive <change-id>
```

The OpenSpec role installs OpenSpec (`@fission-ai/openspec`), BMAD (`bmad-method`), gstack, CodeGraph, and the first-party `init-project` skill that registers `openspec/schemas/superpowers-bridge/`. Keep OpenSpec in its native `openspec/` directory; AIRules does not wrap it under `.airules/`.

### Optional Spec Kit Role

Use `speckit-development` only when a project explicitly chooses GitHub Spec Kit instead of OpenSpec. It installs GitHub Spec Kit's official `specify` CLI, projects `lihan3238/speckit-superpowers-bridge`, and keeps the official Superpowers skills namespace available for bridge execution. Initialize each target project with Spec Kit itself and then install the bridge extension from its release ZIP:

```bash
specify init . --integration codex
specify extension add speckit-superpowers-bridge --from https://github.com/lihan3238/speckit-superpowers-bridge/releases/latest/download/speckit-superpowers-bridge.zip
```

Choose another official integration when needed, such as `claude`, `copilot`, or `gemini`. Add `--force` for an existing non-empty directory and `--ignore-agent-tools` when you need to skip agent tool detection. After initialization, use the native Spec Kit design flow: `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, and `/speckit.analyze`. In Spec Kit projects, prefer `$speckit-superpowers-bridge` on Codex or `/speckit-superpowers-bridge` on Claude Code over direct `/speckit.implement`; the bridge keeps Spec Kit artifacts canonical and delegates implementation discipline to native Superpowers.

The role also ships a complete `init-project` skill so agents can run the full initialization sequence consistently inside target projects. That wrapper injects project rules, links `CLAUDE.md`, runs Spec Kit and bridge extension commands, initializes CodeGraph, and does not copy OpenSpec schemas or AIRules OpenSpec initialization assets.

### Product Spec Usage

Use the product schema after initializing a product, planning, or requirements repository with the product `init-project` skill.

```text
/opsx:propose "<product-change>"
/opsx:apply <change-id>
/opsx:archive <change-id>
```

Run `/opsx:apply <change-id>` again to continue a paused product package. The product `init-project` skill sets `openspec/config.yaml` to `schema: product-pm-bridge`, so this workflow uses `product-pm-bridge` by default.

Product changes use pm-skills for lightweight solution brief, PRD, acceptance criteria and edge cases. For company PRDs, long documents or high-risk changes, use the BMAD skills installed by init-project: `bmad-shard-doc` to shard long source documents, `bmad-prd` to create/update/validate PRDs, `bmad-create-epics-and-stories` to produce developer-ready epics and stories, and `bmad-generate-project-context` to capture downstream context. Durable context is promoted to `knowledge/index.md` only after review; it does not become a rules file.

## Project Structure

```
~/.moluoxixi/
├── roles/
│   ├── common/
│   │   ├── hooks/
│   │   │   └── session-log.mjs
│   │   └── skills/        # Shared handoff / frontend testing / memory skills
│   ├── openspec-development/
│   │   ├── constants/
│   │   │   └── skills.ts # Explicit OpenSpec + BMAD + gstack role registry
│   │   ├── mcp/
│   │   │   └── mcp.json   # Neutral MCP source projected per host format
│   │   ├── hooks/
│   │   └── skills/
│   ├── speckit-development/
│   │   ├── constants/
│   │   │   └── skills.ts # Optional Spec Kit + Superpowers bridge role registry
│   │   ├── mcp/
│   │   └── rules/
│   ├── product/
│   │   ├── constants/
│   │   │   └── skills.ts  # Product / PM skill registry
│   │   └── skills/         # First-party product init-project skill
│   └── ecc-development/
│       └── constants/
│           └── skills.ts  # ECC role skill registry
├── local/
│   └── skills/              # User-added skills copied by `airules add`
├── vendor/
│   ├── repos/               # Cloned third-party source repos
│   └── skills/              # Flattened extracted skills
└── scripts/                 # Install / sync scripts (tests colocated in __test__/ beside the code)
```

> Source `skills/` folders may be grouped recursively; installed vendor and host skill directories are flattened by leaf skill name.
> The default `ecc-development` role uses ECC official installers where possible and AIRules fallback projection for audited non-native hosts. The explicit `openspec-development` role does not project an always-on global rules baseline; it installs OpenSpec, BMAD, gstack, CodeGraph, and the first-party OpenSpec schema bootstrap. The optional `speckit-development` role does not install an OpenSpec schema; it installs Spec Kit's official CLI, projects the Spec Kit + Superpowers bridge skill, and leaves project structure to `specify init` plus `specify extension add`.

## Why Not Just Another AI Rules Repo?

There are many AI rules repositories out there. Here's what makes AIRules different:

| Other Approaches | AIRules |
|-----------------|---------|
| One large rules file | Modular, composable skill units |
| Manual copy-paste | Script-driven automated distribution |
| Single agent support | Many host targets plus the `.agents` shared layer |
| Everything custom-written | Clone mature skills + write only what's unique |
| One-time setup | Continuous sync + self-healing repair |

## Roadmap / TODO

- [x] **Development runtime loop hooks removed** — development no longer ships the old runtime loop hook / ledger chain. Host hook projection keeps the common `session-log.mjs` Stop hook only; loop limits remain a prose and workflow-contract concern.

## License

MIT
