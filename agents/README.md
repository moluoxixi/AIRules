# Agents

Role-based agent cards for the AIRules system. Agents define **who** you are, while skills define **how** to do things and rules define **what standards** to follow.

## Three-Layer Responsibility Separation

| Layer | Responsibility | Question Answered | Examples |
|-------|---------------|-------------------|----------|
| **Agent** | Role definition | Who am I? | frontend-dev, backend-dev, fullstack-dev, stack-reviewer |
| **Skill** | Operational know-how | How do I do it? | superpowers/*, frontend-design, code-reviewer (vendor) |
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
2. **Loading**: Agent loads relevant rules (`rules/{stack}/*`)
3. **Always Load**: All agents load `rules/common/*`
4. **Vendor Skills**: Agent loads vendor skills per its Vendor Skills section (`superpowers/*` for workflow, plus role-specific vendor skills)
5. **Execution**: Agent delegates to `superpowers/*` skills for workflow orchestration

## Standard 7-Phase Workflow

All development agents follow the workflow defined in `rules/common/workflow.md`:

```
Design → Plan → Code → Test → Verify → Review → Deliver
```

The `superpowers/*` vendor skills orchestrate transitions between phases (brainstorming → writing-plans → TDD → verification-before-completion → finishing-a-development-branch).

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
4. **Specify rules/skills**: What rules to always load
5. **List vendor skills**: Which vendor skills this agent uses
6. **Define collaboration**: How this agent interacts with others
7. **Update README**: Add to inventory

### Agent Template

Agent cards are thin role-declaration layers: they define **Who** (identity) + **Skills** (capabilities) + **Rules** (standards). Workflow logic and operational responsibilities live in `superpowers/*` skills.

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

## Vendor Skills

- `superpowers/*` — AI-native workflow orchestration
- List role-specific vendor skills here

## Collaboration

How this agent interacts with others.
```

## References

- Workflow definition: `rules/common/workflow.md`
- Coding standards: `rules/common/coding-standards.md`
- Testing standards: `rules/common/testing-standards.md`
- Verification standards: `rules/common/verification.md`
- Comment rules: `rules/common/comments.md`
