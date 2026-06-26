# Moluoxixi AIRules

> 🧩 Build your own AI coding best practices by composing modular skills — like LEGO bricks.

**English** | **[中文](README-zh.md)**

## What is this?

AIRules is a **composable AI skill distribution system**. The core idea is simple:

- **Clone** mature AI Skills from the community (Anthropic, Google Gemini, OpenAI, Superpowers, etc.)
- **Write** your own domain-specific Skills
- **Compose** these small, modular units into your personalized development best practices
- **Distribute** them to all your AI agents (Claude, Cursor, Codex, Gemini, etc.) with one command

## Core Philosophy

### 🏗️ Three-Layer Architecture

```
┌─────────────────────────────────────────────┐
│  🔧 First-Party Skills (your own)           │ ← Your competitive edge
│  init-project / knowledge-search / docs      │
├─────────────────────────────────────────────┤
│  📦 Third-Party Skills (cloned from mature  │ ← Stand on the shoulders
│  repos) superpowers · anthropic/design · ...│   of giants
├─────────────────────────────────────────────┤
│  🚀 Distribution Engine (one-command deploy │ ← Automated infrastructure
│  to all AI agents)                          │
└─────────────────────────────────────────────┘
```

### 📐 Design Principles

| Principle | Description |
|-----------|-------------|
| **Small, Modular Units** | Each skill does one thing — independent, testable, replaceable |
| **Composition > Monolith** | Like Unix pipes — combine small tools to solve big problems |
| **Capability First** | Install workflow, tool, design, and verification skills by default; generate code standards from the current repository |
| **Self-Healing Distribution** | One command syncs to all agents with auto link repair and verification |

## What You Get

- 🔥 **Curated** workflow, tool, design, and verification AI Skills out of the box
- 🧠 **Automatic CodeGraph install** via `npm install --global @colbymchenry/codegraph`, followed by `codegraph install`, during default sync
- 🧱 **Reserved first-party expansion slots** so you can add your own top-level skills later without changing the distribution model
- 🌐 **Multi-agent sync**: configure once, works across Claude / Cursor / Codex / Hermes / Qoder / Trae / OpenCode / CC-Switch
- 🔄 **Continuous updates**: one command pulls latest upstream skills

## Installation

**Use as a Node CLI (local development / npm link):**

```bash
npm install -g pnpm
pnpm build
npm link
airules sync --host all
```

Add a local skill and sync it to every host:

```bash
airules add ./my-skill --host all
```

The `add` command requires the source directory to contain `SKILL.md`. It copies the skill to `~/.moluoxixi/skills/<skill-name>` and then uses the same vendor/host projection pipeline.

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
> **Sync Process**: This command rebuilds vendor skills, runs setup commands, cleans dead links, and runs host verification after projection. The default setup globally installs and initializes CodeGraph; use `airules sync --skip-vendors` when you do not want to refresh third-party vendor repositories or run setup.

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
npm run rules:install -- --host <host-name> (e.g., claude)
```

**Windows CMD:**

```cmd
git clone https://github.com/moluoxixi/AIRules.git "%USERPROFILE%\.moluoxixi"
cd "%USERPROFILE%\.moluoxixi"
npm run rules:install -- --host <host-name> (e.g., claude)
```

**Windows PowerShell:**

```powershell
git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\.moluoxixi"
cd "$env:USERPROFILE\.moluoxixi"
npm run rules:install -- --host <host-name> (e.g., claude)
```

> [!TIP]
> Inside the cloned repository, `npm run rules:install -- --host claude` still works and now forwards to `airules sync`.

---

## CLI Commands

| Command | Purpose |
|---------|---------|
| `airules sync --host all` | Sync built-in, user-defined, and third-party skills to every existing host |
| `airules add ./my-skill --host all` | Add a local skill and sync it to every host |
| `airules add ./my-skill --name review-plus --overwrite` | Set the installed skill name and replace an existing user skill |
| `airules verify --host codex` | Verify skill links for one host |

Common options:

| Option | Description |
|--------|-------------|
| `--home <dir>` | AIRules install directory, defaults to `~/.moluoxixi` |
| `--user-home <dir>` | User home used for host directories, defaults to the current OS home |
| `--host <name\|all>` | Target host, defaults to `all` |
| `--skip-vendors` | Do not refresh third-party vendor repos during `sync` |
| `--skip-sync` | Add the user skill without projecting it immediately |
| `--no-verify` | Skip host verification |

---

### Agent Support Matrix

Moluoxixi AIRules supports a growing ecosystem of AI agents through automated projection:

| Agent              | `--host` Value | Host Path                 | Projection Method | Rules Baseline |
|--------------------|----------------|---------------------------|-------------------|----------------|
| **Claude Code**    | `claude` | `~/.claude/`              | Symlink | `CLAUDE.md` |
| **Codex**          | `codex` | `~/.codex/`               | Symlink | `AGENTS.md` |
| **Hermes**         | `hermes` | `~/AppData/Local/hermes/` | Symlink + baseline block | Appended into `SOUL.md` |
| **Hermes Desktop** | `hermes desktop` | `~/AppData/Local/hermes/` | Symlink + baseline block | Appended into `SOUL.md` |
| **Cursor**         | `cursor` | `~/.cursor/`              | Symlink | `AGENTS.md` |
| **Trae**           | `trae` | `~/.trae/`                | Symlink; MCP at `~/AppData/Roaming/Trae/User/mcp.json` | `AGENTS.md` |
| **Trae CN**        | `trae-cn` | `~/.trae-cn/`            | Symlink; MCP at `~/AppData/Roaming/Trae CN/User/mcp.json` | `AGENTS.md` |
| **Trae Solo**      | `trae-solo` | `~/AppData/Roaming/TRAE SOLO/User/` | MCP only | N/A |
| **Trae Solo CN**   | `trae-solo-cn` | `~/AppData/Roaming/TRAE SOLO CN/User/` | MCP only | N/A |
| **Qoder**          | `qoder` | `~/AppData/Roaming/Qoder/SharedClientCache/` | MCP only | N/A |
| **QoderWork**      | `qoderwork` | `~/.qoderwork/`        | Symlink; no verified MCP config | `AGENTS.md` |
| **OpenCode**       | `opencode` | `~/.config/opencode/`     | Symlink | `AGENTS.md` |
| **CC-Switch**      | `cc-switch` | `~/.cc-switch/`           | Symlink | `AGENTS.md` |

> [!NOTE]
> All first-party and curated third-party skills are automatically projected into the agent's dedicated skills directory during installation. Hermes `SOUL.md` is an identity/persona file, so AIRules never overwrites it — instead it injects the rules baseline as an idempotent managed block wrapped in `<!-- AIRULES:BASELINE:START/END -->`. Each `sync` removes the old block and rewrites the latest one, keeping exactly one copy without clobbering your identity content. AIRules no longer ships its former Hermes-inspired learning/curation skills by default; learning candidates remain an internal document convention, not an installed agent skill.

---

## Skills Overview

### First-Party Skills (Custom)

| Name | Description |
|------|-------------|
| **init-project** | New-project initialization skill that analyzes project context, injects rules into root `AGENTS.md`, links `CLAUDE.md`, and runs `codegraph init -i` |
| **architecture-docs** | Generates or updates architecture docs, module boundaries, and ADRs under `docs/architecture/` while maintaining docs navigation |
| **prd-docs** | Generates or updates business PRDs under `docs/prds/` and maintains docs navigation |
| **api-docs** | Generates or updates API and integration contracts under `docs/api/` and maintains docs navigation |
| **components-docs** | Generates or updates frontend component docs under `docs/components/` and maintains docs navigation |
| **test-docs** | Generates or updates test design and validation docs under `docs/test/` and maintains docs navigation |
| **retrospective-correction** | Handles implementation drift with lightweight direct fixes for minor deviations and confirmed correction plans for major deviations |
| **handoff** | When a session must pause or hand off to another agent, compacts progress into a handoff doc (written to temp dir, references existing artifacts, redacted) for a fresh agent to pick up |
| **architecture-deepening** | When improving architecture, finding refactor opportunities, or eliminating shallow modules, produces deepening candidates and cross-seam testing strategy based on the "deep module" lens |

> First-party skills may live under nested source folders, but installation flattens them into `vendor/skills/<skill-name>`. First-party rules live in `rules/AGENTS.md`; CodeGraph install commands live in the vendor setup section of `constants/skills.ts`.

### Third-Party Skills (Curated)

| Source | Skills | Description |
|--------|--------|-------------|
| **Google Gemini** | code-reviewer-gemini, pr-creator-gemini | Automated code review and PR creation |
| **Vercel Labs** | find-skills-vercel | Open ecosystem skill discovery and installation |
| **Anthropic** | frontend-design-anthropic | Production-grade frontend visual design guidance |
| **OpenAI** | playwright-openai | Browser automation and UI-flow debugging |
| **Superpowers** | All upstream skills under `skills/` | Full Superpowers namespace installation, flattened into `vendor/skills/<skill-name>` |

> Curated third-party skills use source suffixes as installation names to avoid bare-name collisions with Superpowers, user-local skills, or other vendors.

## Project Structure

```
~/.moluoxixi/
├── rules/
│   └── AGENTS.md          # Repository-level operating rules
├── skills/                  # First-party skills (your core assets)
│   ├── init-project/
│   │   ├── references/
│   │   └── scripts/
│   ├── architecture-docs/
│   ├── api-docs/
│   ├── components-docs/
│   ├── prd-docs/
│   ├── retrospective-correction/
│   └── test-docs/
├── vendor/
│   ├── repos/               # Cloned third-party source repos
│   └── skills/              # Flattened extracted skills
├── constants/skills.ts      # Single source of truth for vendor config
├── scripts/                 # Install / sync / verify scripts
└── tests/                   # Automated verification tests
```

> Source `skills/` folders may be grouped recursively; installed vendor and host skill directories are flattened by leaf skill name.

## Why Not Just Another AI Rules Repo?

There are many AI rules repositories out there. Here's what makes AIRules different:

| Other Approaches | AIRules |
|-----------------|---------|
| One large rules file | Modular, composable skill units |
| Manual copy-paste | Script-driven automated distribution |
| Single agent support | 7 AI agents supported simultaneously |
| Everything custom-written | Clone mature skills + write only what's unique |
| One-time setup | Continuous sync + self-healing repair |

## License

MIT
