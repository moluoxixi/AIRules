# Agents

Role-based agent cards for the AIRules system. Agents define **who** you are, while skills define **how** to do things and rules define **what standards** to follow.

## Three-Layer Responsibility Separation

| Layer | Responsibility | Question Answered | Examples |
|-------|---------------|-------------------|----------|
| **Agent** | Role definition | Who am I? | frontend-dev, backend-dev, fullstack-dev, stack-reviewer |
| **Skill** | Operational know-how | How do I do it? | standard-dev-workflow, coding-standards, testing-workflow |
| **Rule** | Standards & constraints | What standards apply? | `rules/common/*`, `rules/react/*`, `rules/go/*` |

## Agent Inventory

| Agent | Type | Primary Responsibility |
|-------|------|------------------------|
| [frontend-dev](frontend-dev.md) | Role | Frontend development (Vue, React, Next.js) |
| [backend-dev](backend-dev.md) | Role | Backend development (Java, NestJS, Go, Python, Rust) |
| [fullstack-dev](fullstack-dev.md) | Role | Full-stack development spanning both layers |
| [stack-reviewer](stack-reviewer.md) | Review | Cross-cutting review, rule-skill alignment |

## How Agents Work

1. **Detection**: Agent detects project tech stack from files (package.json, go.mod, pom.xml, etc.)
2. **Loading**: Agent loads relevant rules (`rules/{stack}/*`) and skills (`{stack}-patterns`)
3. **Always Load**: All agents load `rules/common/*` and universal skills (`coding-standards`, `testing-workflow`, etc.)
4. **Execution**: Agent delegates to `standard-dev-workflow` skill for phase orchestration

## Standard 7-Phase Workflow

All development agents follow the workflow defined in `rules/common/workflow.md`:

```
Design → Plan → Code → Test → Verify → Review → Deliver
```

The `standard-dev-workflow` skill orchestrates transitions between phases.

## Agent Selection Guide

| Project Type | Use Agent |
|--------------|-----------|
| Vue/React SPA or component library | `frontend-dev` |
| API service, microservice, backend | `backend-dev` |
| Full-stack app with frontend + backend | `fullstack-dev` |
| Reviewing rule/skill changes | `stack-reviewer` |

## Adding New Agents

To extend the agent system:

1. **Create agent file**: `agents/{agent-name}.md`
2. **Define metadata**: name, description, tools
3. **Document tech detection**: How the agent identifies its stack
4. **Specify rules/skills**: What to load for this role
5. **Define responsibilities**: Clear scope boundaries
6. **Update README**: Add to inventory

### Agent Template

```markdown
---
name: agent-name
description: Brief description of agent purpose.
tools: Read, Write, Grep, Glob, Bash
---

# Agent Name

Role description (third person).

## Tech Stack Detection

How this agent identifies applicable projects.

## Always Load

- **Rules**: Universal rules to always load
- **Skills**: Universal skills to always load

## Workflow

Which workflow this agent follows.

## Responsibilities

- Task 1
- Task 2

## Collaboration

How this agent interacts with others.
```

## References

- Workflow definition: `rules/common/workflow.md`
- Coding standards: `rules/common/coding-standards.md`
- Testing standards: `rules/common/testing-standards.md`
- Verification standards: `rules/common/verification.md`
- Comment rules: `rules/common/comments.md`
