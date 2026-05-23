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
│  software-development-workflow / standards   │
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

- 🔥 **25+ curated** frontend/backend/general AI Skills out of the box
- 🧱 **Reserved first-party expansion slots** so you can add your own top-level skills later without changing the distribution model
- 🌐 **Multi-agent sync**: configure once, works across Claude / Cursor / Codex / Qoder / Tare / OpenCode / CC-Switch
- 🔄 **Continuous updates**: one command pulls latest upstream skills

## Installation

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
> **All-in-One Process**: This command automatically pulls latest code, installs dependencies, cleans dead links, and **runs a full verification check**. To uninstall, simply add `--mode uninstall`.

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
> **All-in-One Process**: This command automatically pulls latest code, installs dependencies, cleans dead links, and **runs a full verification check**. To uninstall, simply add `--mode uninstall`.

---

### Agent Support Matrix

Moluoxixi AIRules supports a growing ecosystem of AI agents through automated projection:

| Agent | `--host` Value | Host Path | Projection Method | Baseline File |
|-------|----------------|-----------|-------------------|---------------|
| **Claude Code** | `claude` | `~/.claude/` | Symlink | `CLAUDE.md` |
| **Codex** | `codex` | `~/.codex/` | Symlink | `AGENTS.md` |
| **Cursor** | `cursor` | `~/.cursor/` | Symlink | `AGENTS.md` |
| **Tare** | `tare` | `~/.tare/` | Symlink | `AGENTS.md` |
| **OpenCode** | `opencode` | `~/.config/opencode/` | Symlink | `AGENTS.md` |
| **CC-Switch** | `cc-switch` | `~/.cc-switch/` | Symlink | `AGENTS.md` |

> [!NOTE]
> All skills are automatically projected into the agent's dedicated skills directory during installation.

---

## Skills Overview

### First-Party Skills (Custom)

| Name | Description |
|------|-------------|
| **software-development-workflow** | Standard software development workflow for requirements, splitting, design, implementation, verification, review, and delivery reports |
| **frontend-code-standard** | Vue 3 and React TypeScript/JavaScript frontend code standards for components, modules, utility libraries, UI component libraries, review output, and delivery checks |
| **node-code-standard** | Node.js backend implementation standards for TypeScript/JavaScript services with explicit contracts, runtime validation, dependency injection, transaction boundaries, persistence encapsulation, and delivery checks |
| **nestjs-code-standard** | NestJS backend implementation and review standards for new code, rewrites, and code reviews with DTO contracts, ValidationPipe, constructor injection, transaction boundaries, persistence encapsulation, and evidence-based review output |
| **java-code-standard** | Java and Spring Boot backend code standards for Java 17+ baseline, Java 21/25 LTS, Maven, and Gradle with domain packages, constructor injection, Bean Validation, transaction boundaries, migrations, and error mapping |
| **skill-validation-standard** | Minimal skill validation standard for generated or modified Claude/Codex skills, covering SKILL.md YAML frontmatter, folder-name matching, and line-count limits |

> Workflow standards are projected as a namespace. First-party rules live in `rules/AGENTS.md`.

### Third-Party Skills (Curated)

| Source | Skills | Description |
|--------|--------|-------------|
| **antfu** | vue, nuxt, pinia, vite, vitest, unocss, pnpm, vitepress, slidev, tsdown, turborepo + 6 more | Vue ecosystem + frontend toolchain best practices |
| **Google Gemini** | code-reviewer, pr-creator | Automated code review and PR creation |
| **Vercel Labs** | find-skills | Open ecosystem skill discovery and installation |
| **OpenAI** | playwright | Browser automation and UI-flow debugging |
| **Superpowers** | Full skill set | Foundation engineering skills (TDD, subagent-driven, etc.) |

## Project Structure

```
~/.moluoxixi/
├── rules/
│   └── AGENTS.md          # Repository-level operating rules
├── skills/                  # First-party skills (your core assets)
│   ├── skill-validation-standard/
│   └── workflow/
│       ├── software-development-workflow/
│       ├── frontend-code-standard/
│       ├── node-code-standard/
│       ├── nestjs-code-standard/
│       └── java-code-standard/
├── vendor/
│   ├── repos/               # Cloned third-party source repos
│   └── skills/              # Extracted third-party skills
├── constants/skills.ts      # Single source of truth for vendor config
├── scripts/                 # Install / sync / verify scripts
└── tests/                   # Automated verification tests
```

> Top-level first-party skills are projected explicitly, while workflow standards stay grouped under the `workflow/` namespace.

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
