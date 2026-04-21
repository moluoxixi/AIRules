# Moluoxixi AIRules

> 🧩 Build your own AI coding best practices by composing modular skills — like LEGO bricks.

**English** | **[中文](README-zh.md)**

## What is this?

AIRules is a **composable AI skill distribution system**. The core idea is simple:

- **Clone** mature AI Skills from the community (antfu, Anthropic, Google Gemini, Vercel, etc.)
- **Write** your own domain-specific Skills
- **Compose** these small, modular units into your personalized development best practices
- **Distribute** them to all your AI agents (Claude, Cursor, Codex, Gemini, etc.) with one command

## Core Philosophy

### 🏗️ Three-Layer Architecture

```
┌─────────────────────────────────────────────┐
│  🔧 First-Party Skills (your own)           │ ← Your competitive edge
│  frontend-workflow / custom workflows        │
├─────────────────────────────────────────────┤
│  📦 Third-Party Skills (cloned from mature  │ ← Stand on the shoulders
│  repos) antfu/vue · anthropic/testing · ... │   of giants
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
| **Third-Party First** | Use mature community skills; only write what's uniquely yours |
| **Self-Healing Distribution** | One command syncs to all agents with auto link repair and verification |

## What You Get

- 🔥 **22+ curated** frontend/general AI Skills out of the box
- 🛠️ **Zero-barrier skill creation** with the built-in skill-creator-pro
- 🌐 **Multi-agent sync**: configure once, works across Claude / Cursor / Codex / Qoder / Tare / OpenCode / CC-Switch
- 🔄 **Continuous updates**: one command pulls latest upstream skills

## Installation

**macOS / Linux / Git Bash:**

```bash
git clone https://github.com/moluoxixi/AIRules.git "$HOME/.moluoxixi"
cd "$HOME/.moluoxixi"
npm run rules:install -- --host all
```

**Windows PowerShell:**

```powershell
git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\.moluoxixi"
cd "$env:USERPROFILE\.moluoxixi"
npm run rules:install -- --host all
```

**Windows CMD:**

```cmd
git clone https://github.com/moluoxixi/AIRules.git "%USERPROFILE%\.moluoxixi"
cd "%USERPROFILE%\.moluoxixi"
npm run rules:install -- --host all
```

> [!TIP]
> **All-in-One Process**: This command automatically pulls latest code, installs dependencies, cleans dead links, and **runs a full verification check**. To uninstall, simply add `--mode uninstall`.

---

---

### Agent Support Matrix

Moluoxixi AIRules supports a growing ecosystem of AI agents through automated projection:

| Agent | Projection Method | Baseline File |
|-------|-------------------|---------------|
| **Claude Code** | Symlink to `~/.claude/` | `CLAUDE.md` |
| **Codex** | Symlink to `~/.codex/` | `AGENTS.md` |
| **Cursor** | Symlink to `~/.cursor/` | `AGENTS.md` |
| **Qoder** | Symlink to `~/.qoder/` | `AGENTS.md` |
| **Tare** | Symlink to `~/.tare/` | `AGENTS.md` |
| **OpenCode** | Symlink to `~/.config/opencode/` | `AGENTS.md` |
| **CC-Switch** | Symlink to `~/.cc-switch/` | `AGENTS.md` |

> [!NOTE]
> All skills are automatically projected into the agent's dedicated skills directory during installation.

## Skills Overview

### First-Party Skills (Custom)

| Name | Description |
|------|-------------|
| **frontend-workflow** | Core frontend workflow control: page generation, API integration, and delivery testing |
| **skill-creator-pro** | Meta-skill: complete toolkit for creating, testing, evaluating, and optimizing AI Skills |
| **skill-seekers** | Knowledge ingestion: auto-convert 17 source types (docs, GitHub, PDF, etc.) into standard Skills |

### Third-Party Skills (Curated)

| Source | Skills | Description |
|--------|--------|-------------|
| **antfu** | vue, nuxt, pinia, vite, vitest, unocss, pnpm, vitepress, slidev, tsdown, turborepo + 6 more | Vue ecosystem + frontend toolchain best practices |
| **Google Gemini** | code-reviewer, pr-creator | Automated code review and PR creation |
| **Vercel Labs** | find-skills | Open ecosystem skill discovery and installation |
| **Microsoft** | playwright-cli | Browser automation and E2E testing |
| **Superpowers** | Full skill set | Foundation engineering skills (TDD, subagent-driven, etc.) |

## Project Structure

```
~/.moluoxixi/
├── skills/                  # First-party skills (your core assets)
│   ├── frontend-workflow/
│   ├── skill-creator-pro/
│   └── skill-seekers/
├── vendor/
│   ├── repos/               # Cloned third-party source repos
│   └── skills/              # Extracted third-party skills
├── constants/skills.ts      # Single source of truth for vendor config
├── scripts/                 # Install / sync / verify scripts
└── tests/                   # Automated verification tests
```

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
