# Moluoxixi AIRules

Moluoxixi AIRules is a personal distribution of AI coding workflows and skills, built on top of the Superpowers foundation. It provides a cohesive set of composable "skills" that transform your AI agent into a sophisticated engineering partner.

## How it works

AIRules isn't just a collection of snippets; it's a systematic approach to AI-assisted development. From initial design to subagent-driven implementation and TDD verification, AIRules ensures your agent follows professional engineering standards.

As soon as your agent sees a task, it doesn't just write code. It steps back to brainstorm, creates detailed implementation plans, and works through tasks with rigorous testing and review stages.

## Installation

AIRules is distributed as a set of native plugins and marketplace extensions.

### Claude Code
Register the marketplace and install the plugin:

```bash
/plugin marketplace add moluoxixi/AIRules
/plugin install moluoxixi-ai-rules@AIRules
```

### Cursor
Add the repository as a plugin in Cursor Agent:

```text
/add-plugin https://github.com/moluoxixi/AIRules
```

### OpenCode
Add the plugin to your `opencode.json`:

```json
{
  "plugin": ["moluoxixi@git+https://github.com/moluoxixi/AIRules.git"]
}
```

**Detailed docs:** [docs/README.opencode.md](docs/README.opencode.md)

### Codex / General Agents
Tell your agent to follow the instructions:

```text
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/INSTALL.md
```

**Detailed docs:** [docs/README.codex.md](docs/README.codex.md)

## Core Skills

1. **frontend-workflow** - Specialized workflows for modern frontend development, emphasizing component hygiene and state management.
2. **skill-creator-pro** - A meta-skill for designing, documenting, and testing new AI skills within this distribution.
3. **skill-seekers** - Automatic discovery and loading of relevant skills based on the current context.

## Philosophy

- **Personalized Workflow**: Tailored rules that reflect specific engineering tastes and project needs.
- **Systematic over ad-hoc**: Every change follows a plan and passes a test.
- **Discovery-first**: Skills are naturally discovered and loaded by the environment.

## License

MIT
