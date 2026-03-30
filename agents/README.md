# Agents

Multi-agent orchestration for the standard development workflow.

## Agent Inventory

| Agent | Phase | Primary Responsibility |
|-------|-------|------------------------|
| [workflow-orchestrator](workflow-orchestrator.md) | All | Coordinate phase transitions and agent invocation |
| [code-standards-enforcer](code-standards-enforcer.md) | Code | Enforce naming, complexity, comments, security |
| [test-strategist](test-strategist.md) | Test | Define test strategy, analyze coverage, identify gaps |
| [quality-gate](quality-gate.md) | Verify | Run lint/typecheck/build/security verification pipeline |
| [stack-reviewer](stack-reviewer.md) | Review | Review cross-cutting concerns, rule-skill alignment |

## Workflow Execution Order

```
┌─────────────────────────────────────────────────────────────────┐
│                         DESIGN                                  │
│                    (Human-led planning)                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                          PLAN                                   │
│                   (Human-led breakdown)                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                          CODE                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Code Standards Enforcer                       │   │
│  │  • Naming semantics  • Function complexity              │   │
│  │  • Comment rules     • Security checks                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                          TEST                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Test Strategist                            │   │
│  │  • Strategy selection  • Coverage analysis              │   │
│  │  • Gap identification  • MCP integration                │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                         VERIFY                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Quality Gate                             │   │
│  │  • Lint  • Type check  • Build  • Security scan         │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                         REVIEW                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Stack Reviewer                             │   │
│  │  • Cross-cutting concerns  • Rule-skill alignment       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                    (Human review parallel)                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                        DELIVER                                  │
│                   (Human-led release)                           │
└─────────────────────────────────────────────────────────────────┘
```

## Agent Call Graph

```
Workflow Orchestrator
        │
        ├──► Code Standards Enforcer ──► Test Strategist
        │                                        │
        │                                        ▼
        │                              Quality Gate
        │                                        │
        └────────────────────────────────────────┘
                     (on pass)
                          │
                          ▼
                   Stack Reviewer
```

## Conflict Resolution Priority

When multiple agents provide conflicting recommendations:

1. **Security violations**: Security > Standards > Functionality
2. **Test coverage vs deadline**: Coverage requirements win
3. **Style differences**: Project conventions > Personal preference
4. **Architecture vs speed**: Long-term maintainability wins

## Adding New Agents

To extend the agent system:

1. **Create agent file**: `agents/{agent-name}.md`
2. **Define metadata**: name, description, tools, model
3. **Specify trigger**: When and how the agent is invoked
4. **Document responsibilities**: Clear scope boundaries
5. **Update orchestrator**: Add invocation logic to workflow-orchestrator.md
6. **Update README**: Add to inventory and call graph

### Agent Template

```markdown
---
name: agent-name
description: Brief description of agent purpose.
tools: Read, Grep, Glob
model: gpt-5
---

# Agent Name

Role description (third person).

## Trigger

When this agent is invoked.

## Responsibilities

- Task 1
- Task 2

## Output Format

Expected report structure.

## Collaboration

How this agent interacts with others.
```

## References

- Workflow definition: `rules/common/workflow.md`
- Coding standards: `rules/common/coding-standards.md`
- Testing standards: `rules/common/testing-standards.md`
- Verification standards: `rules/common/verification.md`
- Comment rules: `rules/common/comments.md`
