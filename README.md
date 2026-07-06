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
- 🧠 **Automatic CodeGraph, OpenSpec and BMAD install** via role setup commands during development / product sync
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
> **Sync Process**: `npm run sync` is the default development-role sync (`roles/common` + `roles/development`). Use `npm run sync:development` for an explicit development sync, `npm run sync:product` to sync the product role (`roles/common` + `roles/product`), or `npm run sync:ecc-development` to sync the ECC role (`roles/common` + `roles/ecc-development`). Each sync rebuilds vendor skills, runs setup commands, cleans dead links, and runs host verification after AIRules projection. The default development setup globally installs and initializes CodeGraph, installs OpenSpec (`@fission-ai/openspec`), and installs BMAD (`bmad-method`); product sync installs OpenSpec and BMAD. ECC sync uses the official command `npx -y --package ecc-universal ecc install --profile <profile> --target <target>` for ECC-native hosts such as Codex, Claude, Cursor, and OpenCode; AIRules fallback projection is kept for hosts that ECC does not target natively, such as Qoder. ECC OpenSpec work is tracked upstream in [`affaan-m/ECC#2283`](https://github.com/affaan-m/ECC/issues/2283) and [`affaan-m/ECC#2318`](https://github.com/affaan-m/ECC/pull/2318); as of 2026-07-06, the PR was open and unmerged, so this role does not treat the OpenSpec ecosystem as a stable default dependency. Use `airules sync --skip-vendors` when you do not want to refresh third-party vendor repositories, run setup, or invoke ECC official installers.

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

## After `init-project`: Using OpenSpec

`init-project` is setup only. It installs OpenSpec host entries for host directories already present in the project (`.claude`, `.codex`, `.cursor`, `.qoder`, `.trae`, `.opencode`); if none exist, it installs the Qoder entry by default. It also installs BMAD BMM runtime for the detected BMAD tool IDs (`claude-code`, `codex`, `cursor`, `qoder`, `trae`, `opencode`, default `qoder`). Finally, it installs the project-local schema under `openspec/schemas/<schema-name>/`, sets that schema as the project default in `openspec/config.yaml`, and creates `knowledge/index.md`. After initialization, use the OpenSpec `/opsx` workflow.

### Development Spec Usage

Use the development schema after initializing a code repository with the development `init-project` skill.

```text
/opsx:propose "<feature-or-bug>"
/opsx:apply <change-id>
/opsx:archive <change-id>
```

Run `/opsx:apply <change-id>` again to continue a paused implementation. The development `init-project` skill sets `openspec/config.yaml` to `schema: superpowers-bridge`, so this workflow uses `superpowers-bridge` by default.

Development changes start with `intake.md`. If a PRD, product package, story list, acceptance criteria, screenshots or API notes are supplied, the development role validates that the documents are buildable before planning. Use `bmad-shard-doc` for oversized documents, `bmad-prd` to validate PRDs, `bmad-create-epics-and-stories` when developer-ready stories are missing, and `bmad-generate-project-context` when downstream implementation context is needed. Missing API fields, route facts, permissions or state contracts are recorded as `MISSING blocked`; coding does not start until blockers are resolved or explicitly carried.

For frontend UI work, `plan.md` must include `Frontend Planning Notes` and a `Frontend Test Matrix`. Use `frontend-testing` to decide unit/component/E2E/browser checks with the project's existing tools. `gstack-qa-only` can provide report-only browser QA evidence; `gstack-qa` is reserved for explicit "test and fix" requests.

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
│   │   └── skills/        # Shared capture / distill / memory / reflection skills
│   ├── development/
│   │   ├── constants/
│   │   │   └── skills.ts # Development role skill registry
│   │   ├── mcp/
│   │   │   └── mcp.json   # Neutral MCP source projected per host format
│   │   ├── hooks/
│   │   └── skills/
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
> Development no longer projects an always-on global rules baseline. Its setup installs OpenSpec (`@fission-ai/openspec`) and BMAD (`bmad-method`), and `init-project` writes project-local `AGENTS.md`, runs OpenSpec project initialization, installs BMAD BMM runtime, registers project-level `openspec/schemas/superpowers-bridge/`, and creates `knowledge/`. OpenSpec owns its own change/archive directory structure.

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
