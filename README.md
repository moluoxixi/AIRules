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
│  repos) antfu/vue · anthropic/design · ... │   of giants
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

**Use as a Node CLI (local development / npm link):**

```bash
npm install
npm run build
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
> **Sync Process**: This command rebuilds vendor skills, cleans dead links, and runs host verification after projection. Use `airules sync --skip-vendors` when you do not want to refresh third-party vendor repositories.

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

> Workflow standards may live under nested source folders such as `skills/workflow`, but installation flattens them into `vendor/skills/<skill-name>`. First-party rules live in `rules/AGENTS.md`.

### Third-Party Skills (Curated)

| Source | Skills | Description |
|--------|--------|-------------|
| **antfu** | vue, nuxt, pinia, vite, vitest, unocss, pnpm, vitepress, slidev, tsdown, turborepo + 4 more | Vue ecosystem + frontend toolchain best practices |
| **Google Gemini** | code-reviewer, pr-creator | Automated code review and PR creation |
| **Vercel Labs** | find-skills | Open ecosystem skill discovery and installation |
| **Vercel Agent Skills** | react-best-practices, react-native-skills, web-design-guidelines | React/React Native implementation guidance and Web UI review |
| **Anthropic** | frontend-design | Production-grade frontend visual design guidance |
| **OpenAI** | playwright | Browser automation and UI-flow debugging |
| **Superpowers** | systematic-debugging, verification-before-completion, receiving-code-review, writing-skills, using-git-worktrees, writing-plans | Selected codebase workflow skills without default TDD or subagent execution |

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
