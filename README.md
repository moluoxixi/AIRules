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
- 🧠 **Automatic CodeGraph and OpenSpec install** via role setup commands during default development sync
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
> **Sync Process**: `npm run sync` is the default development-role sync (`roles/common` + `roles/development`). Use `npm run sync:development` for an explicit development sync, or `npm run sync:product` to sync the product role (`roles/common` + `roles/product`). Each sync rebuilds vendor skills, runs setup commands, cleans dead links, and runs host verification after projection. The default development setup globally installs and initializes CodeGraph, and installs OpenSpec (`@fission-ai/openspec`); use `airules sync --skip-vendors` when you do not want to refresh third-party vendor repositories or run setup.

---

## Publishing

Publishing is handled by `.github/workflows/publish.yml`.

1. Create an npm automation token with publish permission and save it as the GitHub Actions repository secret `NPM_TOKEN`.
2. Bump `package.json` to the version you want to publish, then push a matching Git tag such as `v0.1.0`.
3. The pushed tag publishes automatically; you can also manually run the `Publish package` workflow with an existing tag name.
4. The workflow installs dependencies, verifies the tag matches `package.json`, runs lint/typecheck/tests, and publishes with `npm publish --provenance --access public`.

The workflow uses `npm install` because this repository intentionally does not track lockfiles.

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

## CLI Commands

| Command | Purpose |
|---------|---------|
| `airules sync --host all` | Sync built-in, user-defined, and third-party skills to every existing host |
| `npm run sync` | Sync the default development role to every existing host |
| `npm run sync:development` | Explicitly sync the development role to every existing host |
| `npm run sync:product` | Sync the product role to every existing host |
| `airules add ./my-skill --host all` | Add a local skill and sync it to every host |
| `airules add ./my-skill --name review-plus --overwrite` | Set the installed skill name and replace an existing user skill |
| `airules verify --host codex` | Verify skill links for one host |

Common options:

| Option | Description |
|--------|-------------|
| `--home <dir>` | AIRules install directory, defaults to `~/.moluoxixi` |
| `--user-home <dir>` | User home used for host directories, defaults to the current OS home |
| `--host <name\|all>` | Target host, defaults to `all` |
| `--role <name>` | First-party role to sync, defaults to `development`; use `product` for product / PM skills |
| `--skip-vendors` | Do not refresh third-party vendor repos during `sync` |
| `--skip-sync` | Add the user skill without projecting it immediately |
| `--sync-vendors` | Refresh third-party vendor repos while running `add`; `add` skips vendor refresh by default |
| `--no-verify` | Skip host verification |

---

### Agent Support Matrix

Moluoxixi AIRules supports a growing ecosystem of AI agents through automated projection:

| Agent | `--host` Value | Host / MCP Path | Projection Method | Rules Baseline |
|-------|----------------|-----------------|-------------------|----------------|
| **Claude Code** | `claude` | `~/.claude/` | Skills + agents symlink; MCP at `~/.claude/.mcp.json` | `CLAUDE.md` |
| **Codex** | `codex` | `~/.codex/` | Skills symlink; agents converted to TOML; MCP in `config.toml` | `AGENTS.md` |
| **Hermes** | `hermes` | `~/AppData/Local/hermes/` | Skills symlink + baseline managed block | Appended into `SOUL.md` |
| **Hermes Desktop** | `hermes desktop` | `~/AppData/Local/hermes/` | Skills symlink + baseline managed block | Appended into `SOUL.md` |
| **Cursor** | `cursor` | `~/.cursor/` | Skills symlink to `skills-cursor`; agents symlink; MCP at `mcp.json` | `AGENTS.md` |
| **Agents.md shared layer** | `agentsmd` | `~/.agents/` | Skills symlink + agents projected to `subagents/`; explicit only, not included in `--host all` | N/A |
| **Trae** | `trae` | `~/.trae/`; MCP at `~/AppData/Roaming/Trae/User/mcp.json` | Skills + agents symlink; MCP merge | `AGENTS.md` |
| **Trae CN** | `trae-cn` | `~/.trae-cn/`; MCP at `~/AppData/Roaming/Trae CN/User/mcp.json` | Skills + agents symlink; MCP merge | `AGENTS.md` |
| **Trae Solo** | `trae-solo` | MCP at `~/AppData/Roaming/TRAE SOLO/User/mcp.json` | MCP only | N/A |
| **Trae Solo CN** | `trae-solo-cn` | MCP at `~/AppData/Roaming/TRAE SOLO CN/User/mcp.json` | MCP only | N/A |
| **Qoder** | `qoder` | `~/.qoder/`; MCP at `~/AppData/Roaming/Qoder/SharedClientCache/mcp.json` | Skills + agents symlink; three-event hooks; MCP merge | `AGENTS.md` |
| **QoderWork** | `qoderwork` | `~/.qoderwork/` | Skills + agents symlink; no verified MCP config | `AGENTS.md` |
| **OpenCode** | `opencode` | `~/.config/opencode/` | Skills + agents symlink; MCP in `opencode.json` | `AGENTS.md` |
| **CC-Switch** | `cc-switch` | `~/.cc-switch/` | Skills + agents symlink | `AGENTS.md` |

> [!NOTE]
> All first-party and curated third-party skills are automatically projected into the agent's dedicated skills directory during installation. Hermes `SOUL.md` is an identity/persona file, so AIRules never overwrites it — instead it injects the rules baseline as an idempotent managed block wrapped in `<!-- AIRULES:BASELINE:START/END -->`. Each `sync` removes the old block and rewrites the latest one, keeping exactly one copy without clobbering your identity content. AIRules no longer ships its former Hermes-inspired learning/curation skills by default; learning candidates remain an internal document convention, not an installed agent skill.

---

## Skills Overview

### First-Party Skills (Custom)

| Role | Skills |
|------|--------|
| **common** | `session-capture`, `distill-candidates`, `recall-memory`, `remember`, `reflect` |
| **development** | `init-project`, `handoff` |
| **product** | `init-project` |

> First-party role assets live under `roles/<role>/`. Development and product role registries are maintained in `roles/development/constants/skills.ts` and `roles/product/constants/skills.ts`. Installation flattens skill source folders by leaf directory name into `vendor/skills/<skill-name>`. Role sync overlays `roles/common/` first, then the selected role (`development` by default, or `product` via `--role product`); selected-role assets override common assets with the same name. Product PM methods (`deliver-prd`, `deliver-user-stories`, `deliver-acceptance-criteria`, `deliver-edge-cases`, `develop-adr`, `develop-solution-brief`) come from the `pmSkills` upstream vendor, while product first-party `init-project` installs OpenSpec's `product-pm-bridge` schema.

### Third-Party Skills (Curated)

| Source | Skills | Description |
|--------|--------|-------------|
| **Google Gemini** | code-reviewer-gemini, pr-creator-gemini | Automated code review and PR creation |
| **Vercel Labs** | find-skills-vercel | Open ecosystem skill discovery and installation |
| **Anthropic** | frontend-design-anthropic | Production-grade frontend visual design guidance |
| **OpenAI** | playwright-openai | Browser automation and UI-flow debugging |
| **Superpowers** | upstream `skills/` namespace | Development role installs the skills version and flattens leaf skill names for multi-host use |
| **PM Skills** | deliver-prd, deliver-user-stories, deliver-acceptance-criteria, deliver-edge-cases, develop-adr, develop-solution-brief | Product / PM methods used by the product role |

> Curated third-party skills use source suffixes as installation names to avoid bare-name collisions with Superpowers, user-local skills, or other vendors.

## After `init-project`: Using OpenSpec

`init-project` is setup only. It installs OpenSpec host entries for host directories already present in the project (`.claude`, `.codex`, `.cursor`, `.qoder`, `.trae`, `.opencode`); if none exist, it installs the Qoder entry by default. It also installs the project-local schema under `openspec/schemas/<schema-name>/`, sets that schema as the project default in `openspec/config.yaml`, and creates `knowledge/index.md`. After initialization, use the OpenSpec `/opsx` workflow.

### Development Spec Usage

Use the development schema after initializing a code repository with the development `init-project` skill.

```text
/opsx:propose "<feature-or-bug>"
/opsx:apply <change-id>
/opsx:archive <change-id>
```

Run `/opsx:apply <change-id>` again to continue a paused implementation. The development `init-project` skill sets `openspec/config.yaml` to `schema: superpowers-bridge`, so this workflow uses `superpowers-bridge` by default.

### Product Spec Usage

Use the product schema after initializing a product, planning, or requirements repository with the product `init-project` skill.

```text
/opsx:propose "<product-change>"
/opsx:apply <change-id>
/opsx:archive <change-id>
```

Run `/opsx:apply <change-id>` again to continue a paused product package. The product `init-project` skill sets `openspec/config.yaml` to `schema: product-pm-bridge`, so this workflow uses `product-pm-bridge` by default.

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
│   └── product/
│       ├── constants/
│       │   └── skills.ts  # Product / PM skill registry
│       └── skills/         # First-party product init-project skill
├── local/
│   └── skills/              # User-added skills copied by `airules add`
├── vendor/
│   ├── repos/               # Cloned third-party source repos
│   └── skills/              # Flattened extracted skills
└── scripts/                 # Install / sync scripts (tests colocated in __test__/ beside the code)
```

> Source `skills/` folders may be grouped recursively; installed vendor and host skill directories are flattened by leaf skill name.
> Development no longer projects an always-on global rules baseline. Its setup installs OpenSpec (`@fission-ai/openspec`), and `init-project` writes project-local `AGENTS.md`, runs OpenSpec project initialization, registers project-level `openspec/schemas/superpowers-bridge/`, and creates `knowledge/`. OpenSpec owns its own change/archive directory structure.

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
