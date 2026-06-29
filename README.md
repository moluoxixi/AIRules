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
│  init-project / workflow / spec / memory     │
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
- 🧠 **Automatic CodeGraph install** via `npm install --global @colbymchenry/codegraph`, followed by `codegraph install`, during default sync
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
| **Qoder** | `qoder` | `~/.qoder/`; MCP at `~/AppData/Roaming/Qoder/SharedClientCache/mcp.json` | Skills + agents symlink; MCP merge | `AGENTS.md` |
| **QoderWork** | `qoderwork` | `~/.qoderwork/` | Skills + agents symlink; no verified MCP config | `AGENTS.md` |
| **OpenCode** | `opencode` | `~/.config/opencode/` | Skills + agents symlink; MCP in `opencode.json` | `AGENTS.md` |
| **CC-Switch** | `cc-switch` | `~/.cc-switch/` | Skills + agents symlink | `AGENTS.md` |

> [!NOTE]
> All first-party and curated third-party skills are automatically projected into the agent's dedicated skills directory during installation. Hermes `SOUL.md` is an identity/persona file, so AIRules never overwrites it — instead it injects the rules baseline as an idempotent managed block wrapped in `<!-- AIRULES:BASELINE:START/END -->`. Each `sync` removes the old block and rewrites the latest one, keeping exactly one copy without clobbering your identity content. AIRules no longer ships its former Hermes-inspired learning/curation skills by default; learning candidates remain an internal document convention, not an installed agent skill.

---

## Skills Overview

### First-Party Skills (Custom)

| Area | Skills |
|------|--------|
| **Project and spec lifecycle** | `init-project`, `spec-workflow`, `handoff` |
| **Requirement, planning, and test design** | `brainstorming`, `writing-plans`, `test-design` |
| **Implementation and testing** | `test-driven-development`, `unit-testing`, `interaction-testing`, `verification-before-completion`, `systematic-debugging` |
| **Review and correction** | `consistency-check`, `requesting-code-review`, `receiving-code-review` |
| **Agent orchestration** | `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `using-git-worktrees`, `finishing-a-development-branch` |
| **Memory and evolution** | `session-capture`, `distill-candidates`, `recall-memory`, `remember`, `reflect` |

> First-party skills may live under nested source folders, but installation flattens them by leaf directory name into `vendor/skills/<skill-name>`. First-party rules live in `rules/AGENTS.md`; first-party agents live in `agents/`; CodeGraph install commands live in the vendor setup section of `constants/skills.ts`.

### Third-Party Skills (Curated)

| Source | Skills | Description |
|--------|--------|-------------|
| **Google Gemini** | code-reviewer-gemini, pr-creator-gemini | Automated code review and PR creation |
| **Vercel Labs** | find-skills-vercel | Open ecosystem skill discovery and installation |
| **Anthropic** | frontend-design-anthropic | Production-grade frontend visual design guidance |
| **OpenAI** | playwright-openai | Browser automation and UI-flow debugging |
| **Product on Purpose PM Skills** | deliver-prd, deliver-user-stories, deliver-acceptance-criteria, deliver-edge-cases, develop-adr, develop-solution-brief | Product and planning methods used alongside first-party workflow skills |
| **Superpowers** | N/A by default | Superpowers methods have been adapted into first-party skills; the upstream namespace is not projected by default to avoid duplicate method skills |

> Curated third-party skills use source suffixes as installation names to avoid bare-name collisions with Superpowers, user-local skills, or other vendors.

## Project Structure

```
~/.moluoxixi/
├── rules/
│   └── AGENTS.md          # Global rules baseline projected to hosts
├── agents/                 # First-party subagent role contracts
├── mcp/
│   └── mcp.json            # Neutral MCP source projected per host format
├── skills/                  # First-party skills (your core assets)
│   ├── init-project/
│   │   ├── references/
│   │   └── scripts/
│   ├── spec-workflow/
│   ├── brainstorming/
│   ├── writing-plans/
│   ├── test-driven-development/
│   ├── verification-before-completion/
│   └── ...
├── local/
│   └── skills/              # User-added skills copied by `airules add`
├── vendor/
│   ├── repos/               # Cloned third-party source repos
│   └── skills/              # Flattened extracted skills
├── constants/skills.ts      # Single source of truth for vendor config
└── scripts/                 # Install / sync scripts (tests colocated in __test__/ beside the code)
```

> Source `skills/` folders may be grouped recursively; installed vendor and host skill directories are flattened by leaf skill name.

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

- [ ] **PreToolUse 客观信号阻断 hook**（回路计数熔断 / `reviewer ≠ coder` 身份隔离）— 立场提议见 [ADR-0006](docs/architecture/decisions/ADR-0006-cross-host-hook-capability-baseline.md)（`proposed`，待仓库维护者批准）。能力基线已核验（五宿主普遍支持 PreToolUse deny），但暂缓实现：PreToolUse 是 guardrail 而非密闭 boundary（可绕道）、Codex 存量 deny bug、Trae 缺 SubagentStop。**待上述限制收敛或确有强约束需求时再立项**，届时需先批准 ADR-0006 第二段。

## License

MIT
