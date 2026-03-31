# Moluoxixi AI Rules

Moluoxixi AI Rules is a personal AI development workflow repository built on top of [superpowers](https://github.com/obra/superpowers).

The core philosophy is not to replace `superpowers`, but to add a long-term maintained layer on top of its workflow capabilities:

- First-party `rules` with layered inheritance architecture
- First-party `agents` for workflow orchestration
- Third-party skills managed through vendor system
- Unified installation structure shared by Claude, Codex, and Qoder

After installation, `superpowers` continues to serve as the baseline workflow layer, while this repository organizes first-party rules and agents, projecting them uniformly to Claude, Codex, and Qoder reading paths.

## Architecture Overview

### Layered Rule Inheritance

Rules follow a three-layer inheritance model:

```
common/                    # Universal principles (cross-language)
├── workflow.md            # Standard development workflow
├── coding-standards.md    # Universal coding conventions
├── comments.md            # Cross-language comment principles
├── testing-standards.md   # Universal testing principles
├── verification.md        # Universal verification gates
└── git-conventions.md     # Version control conventions

{tech-stack}/              # Implementation-specific (concrete tools)
├── java/                  # Java (overview, comments, testing, verification)
├── nest/                  # NestJS (overview, comments, testing, verification)
├── react/                 # React (overview, comments, testing, verification)
├── vue/                   # Vue.js (overview, comments, testing, verification)
├── go/                    # Go (overview, comments, testing, verification)
├── python/                # Python (overview, comments, testing, verification)
├── rust/                  # Rust (overview, comments, testing, verification)
├── frontend/              # Cross-framework frontend guidelines
└── backend/               # Cross-framework backend guidelines
```

**Priority**: Tech-stack rules > Common rules > Vendor skills > Default behavior

### Standard Development Workflow

```
Design → Plan → Code → Test → Verify → Review → Deliver
```

| Phase | Rules | Skills | Agents |
|-------|-------|--------|--------|
| Design | `common/workflow.md` | brainstorming (vendor) | - |
| Plan | `common/workflow.md` | superpowers/writing-plans (vendor) | - |
| Code | `common/coding-standards.md` → `{stack}/overview.md` | frontend-design (vendor, if UI) | frontend-dev / backend-dev / fullstack-dev |
| Test | `common/testing-standards.md` → `{stack}/testing.md` | superpowers/test-driven-development (vendor), webapp-testing (vendor) | - |
| Verify | `common/verification.md` → `{stack}/verification.md` | superpowers/verification-before-completion (vendor) | - |
| Review | `common/coding-standards.md` | code-reviewer (vendor) | stack-reviewer |
| Deliver | `common/git-conventions.md` | pr-creator (vendor) | - |

See [rules/CATALOG.md](rules/CATALOG.md) for complete rule index, skill mapping, and agent orchestration details.

## Quick Start

### Driving AI Through Standard Workflow

Once installed, you can drive AI coding by asking questions that trigger the standard workflow:

**Example 1: Feature Implementation**
```
"I need to add user authentication to my NestJS backend. 
Please follow the standard workflow: plan the approach, 
implement following the rules, write tests, and verify."
```

**Example 2: Code Review**
```
"Please review this React component following the coding-standards 
rules. Check for test coverage and run verification."
```

**Example 3: Bug Fix**
```
"There's a bug in my Go service. Use the rules to 
diagnose, fix following coding standards, and ensure tests pass."
```

The AI will automatically:
1. Reference appropriate rules from `common/` and tech-stack layers
2. Apply vendor skills for specialized tasks (testing, verification, review)
3. Follow the 7-phase workflow from Design to Deliver

## Installation

### Claude

In Claude / Claude Code, tell it:

```text
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.claude/INSTALL.md
```

### Codex

In Codex CLI, tell it:

```text
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/INSTALL.md
```

### Qoder

In Qoder IDE, tell it:

```text
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.qoder/INSTALL.md
```

## Updating

### Claude

In Claude / Claude Code, tell it:

```text
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.claude/UPGRADE.md
```

### Codex

In Codex CLI, tell it:

```text
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/UPGRADE.md
```

### Qoder

In Qoder IDE, tell it:

```text
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.qoder/UPGRADE.md
```

## Repository Structure

```
.
├── rules/              # First-party rules (layered architecture)
│   ├── common/         # Cross-language principles
│   ├── {stack}/        # Tech-stack implementations
│   └── CATALOG.md      # Complete rule-skill-agent mapping
├── skills/             # Vendor skill symlinks
├── agents/             # First-party agents
│   ├── frontend-dev.md
│   ├── backend-dev.md
│   ├── fullstack-dev.md
│   └── stack-reviewer.md
├── .claude/            # Claude-specific installation docs
├── .codex/             # Codex-specific installation docs
├── .qoder/             # Qoder-specific installation docs
├── manifests/          # Vendor skill manifests
└── scripts/            # Installation and sync scripts
```

## Documentation

- [rules/CATALOG.md](rules/CATALOG.md) - Complete rule index and inheritance mapping
- [rules/README.md](rules/README.md) - Rule architecture overview
- [agents/README.md](agents/README.md) - Agent orchestration details
- [.claude/INSTALL.md](.claude/INSTALL.md) - Claude installation guide
- [.codex/INSTALL.md](.codex/INSTALL.md) - Codex installation guide
- [.qoder/INSTALL.md](.qoder/INSTALL.md) - Qoder installation guide
