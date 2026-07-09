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
- 🧠 **Automatic CodeGraph, OpenSpec, BMAD, and gstack install** via the default development role; Spec Kit bridge, ECC, and Trellis stay available through explicit roles
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
> **Sync Process**: `npm run sync` is the default OpenSpec development sync. `npm run sync:development` and `npm run sync:openspec-development` are explicit aliases for the same role. Use `npm run sync:ecc-development` only when you explicitly want the ECC role, `npm run sync:speckit-development` for the optional Spec Kit + Superpowers bridge role, `npm run sync:trellis-development` for the optional Trellis workflow runtime role, or `npm run sync:product` for the product role. Common skills are not implicit; roles opt in through `extendsRoles = ['common']` in their `constants/skills.ts`. Each sync rebuilds vendor skills, runs setup commands, cleans dead links, and runs host verification after AIRules projection. Use `airules sync --skip-vendors` when you do not want to refresh third-party vendor repositories or run setup commands.

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

## Default OpenSpec Workflow

The default development role is `openspec-development`. It uses OpenSpec as the durable specification and change lifecycle, with Superpowers, BMAD, and gstack around it for execution discipline, product planning, review, and release support. Initialize target projects with the OpenSpec `init-project` skill, then use the workflow depth that matches the risk.

Simple loop for small changes:

```text
/opsx:explore "<problem-or-context>"
/opsx:propose "<feature-or-bug>"
/opsx:apply <change-id>
/opsx:archive <change-id>
```

Rigorous loop for larger or ambiguous work:

```text
/opsx:new "<initiative-or-capability>"
/opsx:continue <change-id>
```

Use `new` when the work needs a fuller OpenSpec package. Use `continue` to resume that package and follow the next command it prints, such as `apply`, `verify`, or `archive`.

The OpenSpec role installs OpenSpec (`@fission-ai/openspec`) and CodeGraph, then projects selected BMAD and gstack skills through AIRules' vendor sparse-clone skill pipeline plus the first-party `init-project` skill that registers `openspec/schemas/superpowers-bridge/`. Keep OpenSpec in its native `openspec/` directory; AIRules does not wrap it under `.airules/`.

## ECC Workflow

ECC is an explicit role, not the default. It is useful when you want ECC's upstream agent catalog and core skills to be the main orchestration surface instead of the OpenSpec lifecycle.

Enable it with:

```bash
npm run sync:ecc-development
```

or:

```bash
airules sync --host all --role ecc-development
```

Start with ECC when:

- You want ECC's agents and core skills as the primary day-to-day interface.
- You are working in Claude, Codex, or OpenCode and want ECC's official global target where available.
- You accept AIRules' audited fallback projection for Qoder, Trae, or Trae CN.

Do not start with ECC when:

- You want OpenSpec change records to be the source of truth.
- You need the default AIRules flow with CodeGraph, OpenSpec, BMAD, and gstack.
- You are unsure which system should own planning; start with OpenSpec and switch to ECC only after you deliberately choose that surface.

AIRules syncs ECC by using official ECC installers for native global targets where possible, and by projecting an audited fallback subset for non-native hosts. ECC explicitly inherits `common`, so handoff, memory, reflection, and frontend testing remain available without making common a global default.

### Optional Spec Kit Role

Use `speckit-development` only when a project explicitly chooses GitHub Spec Kit instead of OpenSpec. It installs GitHub Spec Kit's official `specify` CLI, projects `lihan3238/speckit-superpowers-bridge`, and keeps the official Superpowers skills namespace available for bridge execution. Initialize each target project with Spec Kit itself and then install the bridge extension from its release ZIP:

```bash
specify init . --integration codex
specify extension add speckit-superpowers-bridge --from https://github.com/lihan3238/speckit-superpowers-bridge/releases/latest/download/speckit-superpowers-bridge.zip
```

Choose another official integration when needed, such as `claude`, `copilot`, or `gemini`. Add `--force` for an existing non-empty directory and `--ignore-agent-tools` when you need to skip agent tool detection. After initialization, use the native Spec Kit design flow: `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, and `/speckit.analyze`. In Spec Kit projects, prefer `$speckit-superpowers-bridge` on Codex or `/speckit-superpowers-bridge` on Claude Code over direct `/speckit.implement`; the bridge keeps Spec Kit artifacts canonical and delegates implementation discipline to native Superpowers.

The role also ships a complete `init-project` skill so agents can run the full initialization sequence consistently inside target projects. That wrapper injects project rules, links `CLAUDE.md`, runs Spec Kit and bridge extension commands, rewrites upstream plugin-install wording to AIRules projected-skills wording, initializes CodeGraph, and does not copy OpenSpec schemas or AIRules OpenSpec initialization assets. For frontend projects, it installs the project-local `.specify/airules-schemas/frontend-superpowers-bridge/` schema prompt asset instead of injecting frontend rules into `AGENTS.md`.

### Optional Trellis Role

Use `trellis-development` when a project explicitly chooses Trellis as its project-local AI workflow runtime. It installs the `@mindfoldhq/trellis` CLI and projects only an AIRules first-party `init-project` wrapper. The target project then runs Trellis' own initialization to create `.trellis/spec/` as the durable knowledge base, `.trellis/workspace/` as session memory, and `.trellis/tasks/` as task state.

```bash
npm run sync:trellis-development
```

This role does not inherit `common` by default. Trellis already ships its own workflow, memory, hooks, agents, and multi-host adapters, so AIRules keeps the integration thin: no Trellis AGPL templates are copied into `roles/`, and the init skill only writes inside the target project.

### Product Spec Usage

Use the product schema after initializing a product, planning, or requirements repository with the product `init-project` skill.

```text
/opsx:propose "<product-change>"
/opsx:apply <change-id>
/opsx:archive <change-id>
```

Run `/opsx:apply <change-id>` again to continue a paused product package. The product `init-project` skill sets `openspec/config.yaml` to `schema: product-pm-bridge`, so this workflow uses `product-pm-bridge` by default.

Product changes use pm-skills for lightweight solution brief, PRD, acceptance criteria and edge cases. For company PRDs, long documents or high-risk changes, use the BMAD skills projected by role sync: `bmad-shard-doc` to shard long source documents, `bmad-prd` to create/update/validate PRDs, `bmad-create-epics-and-stories` to produce developer-ready epics and stories, and `bmad-generate-project-context` to capture downstream context. Durable context is promoted to `knowledge/index.md` only after review; it does not become a rules file.

## Project Structure

```
~/.moluoxixi/
├── roles/
│   ├── common/
│   │   ├── constants/
│   │   │   └── skills.ts  # Explicit reusable common skill registry
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
│   ├── trellis-development/
│   │   ├── constants/
│   │   │   └── skills.ts  # Trellis CLI setup + init-project wrapper registry
│   │   └── skills/
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
> The default `openspec-development` role does not project an always-on global rules baseline; it installs OpenSpec and CodeGraph, projects selected BMAD/gstack skills, and includes the first-party OpenSpec schema bootstrap. The explicit `ecc-development` role uses ECC official installers where possible and AIRules fallback projection for audited non-native hosts. The optional `speckit-development` role does not install an OpenSpec schema; it installs Spec Kit's official CLI, projects the Spec Kit + Superpowers bridge skill, leaves project structure to `specify init` plus `specify extension add`, and adds a project-local frontend schema prompt asset only when a frontend project is detected.

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
