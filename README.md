# Moluoxixi AIRules

Moluoxixi AIRules is a personal distribution of AI coding workflows and skills, built on top of the Superpowers foundation. It provides a cohesive set of composable "skills" that transform your AI agent into a sophisticated engineering partner.

## How it works

AIRules isn't just a collection of snippets; it's a systematic approach to AI-assisted development. From initial design to subagent-driven implementation and TDD verification, AIRules ensures your agent follows professional engineering standards.

As soon as your agent sees a task, it doesn't just write code. It steps back to brainstorm, creates detailed implementation plans, and works through tasks with rigorous testing and review stages.

## Installation

AIRules uses a **script-driven installation model**. You can deploy and sync skills to all supported AI agents with a single command:

### Quick Full Installation (Recommended)

```bash
git clone https://github.com/moluoxixi/AIRules.git ~/.moluoxixi
cd ~/.moluoxixi
npm install
npm run setup -- --host all --mode install
```

> [!TIP]
> This command automatically cleans up all **dead symlinks** in host directories and ensures the physical integrity of 50+ vendor skills.

### Agent-Specific Entry Points

If you wish to interact with or install to a specific agent, tell it to read its specific instructions:

#### 1. Codex / General
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/INSTALL.md

#### 2. Claude Code
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.claude-plugin/INSTALL.md

#### 3. Cursor
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.cursor-plugin/INSTALL.md

#### 4. Qoder
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.qoder/INSTALL.md

#### 5. Tare
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.tare/INSTALL.md

#### 6. OpenCode
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.opencode/INSTALL.md

## Core Skills

1. **frontend-workflow** - Specialized workflows for modern frontend development, emphasizing component hygiene and state management.
2. **skill-creator-pro** - A meta-skill for designing, documenting, and testing new AI skills within this distribution.
3. **skill-seekers** - Automatic discovery and loading of relevant skills based on the current context.

## Philosophy

- **Personalized Workflow**: Tailored rules that reflect specific engineering tastes and project needs.
- **Systematic over ad-hoc**: Every change follows a plan and passes a test.
- **Self-Healing Distribution**: Skills are automatically synced by scripts, handling environment adaptation and link self-healing (including automatic removal of all dead symlinks).

## License

MIT
