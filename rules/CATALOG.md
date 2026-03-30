# Rules Catalog

Complete index of rules, skills, and agents with inheritance mapping and workflow alignment.

---

## Architecture Overview

### Layered Inheritance Model

```
┌─────────────────────────────────────────────────────────────────┐
│                      common/ (Principles)                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │ coding-     │ │ comments.md │ │ testing-    │ │verification│ │
│  │ standards.md│ │             │ │ standards.md│ │   .md      │ │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────┬──────┘ │
│         │               │               │              │        │
│         ▼               ▼               ▼              ▼        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              workflow.md (Phase Definitions)             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              tech-stack/ (Implementation)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ java/    │ │ nest/    │ │ react/   │ │ vue/     │  ...      │
│  │ overview │ │ overview │ │ overview │ │ overview │           │
│  │ comments │ │ comments │ │ comments │ │ comments │           │
│  │ testing  │ │ testing  │ │ testing  │ │ testing  │           │
│  │ verify   │ │ verify   │ │ verify   │ │ verify   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### Priority Declaration

When conflicts occur, resolution follows this priority (highest to lowest):

1. **Tech-Stack Rules** - Specific implementation requirements
2. **Common Rules** - Cross-language principles
3. **Vendor Skills** - Third-party workflow capabilities
4. **Default Behavior** - AI baseline behavior

---

## Workflow Phase Mapping

| Phase | Rules Reference | Skills | Agents |
|-------|----------------|--------|--------|
| **Design** | `common/workflow.md` | brainstorming (vendor) | - |
| **Plan** | `common/workflow.md` | writing-plans (vendor), `standard-dev-workflow` | `workflow-orchestrator` |
| **Code** | `common/coding-standards.md` → `{stack}/overview.md`<br>`common/comments.md` → `{stack}/comments.md` | `coding-standards`, `{tech}-patterns` | `code-standards-enforcer` |
| **Test** | `common/testing-standards.md` → `{stack}/testing.md` | `testing-workflow`, `ui-test-planning` | `test-strategist` |
| **Verify** | `common/verification.md` → `{stack}/verification.md` | `post-coding-verification` | `quality-gate` |
| **Review** | `common/coding-standards.md` | code-reviewer (vendor) | `stack-reviewer` |
| **Deliver** | `common/git-conventions.md` | pr-creator (vendor) | - |

### Phase Flow

```
Design → Plan → Code → Test → Verify → Review → Deliver
         │      │      │       │        │        │
         │      │      │       │        │        └── git-conventions.md
         │      │      │       │        └── coding-standards.md
         │      │      │       └── verification.md
         │      │      └── testing-standards.md
         │      └── coding-standards.md + comments.md
         └── workflow.md
```

---

## Rule Index by Phase

### Design Phase
| File | Purpose |
|------|---------|
| `common/workflow.md` | Phase definitions and entry/exit criteria |
| `common/overview.md` | High-level architectural principles |

### Plan Phase
| File | Purpose |
|------|---------|
| `common/workflow.md` | Task breakdown and estimation guidelines |

### Code Phase
| File | Purpose |
|------|---------|
| `common/coding-standards.md` | Universal coding principles |
| `common/comments.md` | Cross-language comment conventions |
| `{stack}/overview.md` | Stack-specific architecture |
| `{stack}/comments.md` | Language-specific documentation |

### Test Phase
| File | Purpose |
|------|---------|
| `common/testing-standards.md` | Universal testing principles |
| `{stack}/testing.md` | Stack-specific testing tools and patterns |

### Verify Phase
| File | Purpose |
|------|---------|
| `common/verification.md` | Universal verification gates |
| `{stack}/verification.md` | Stack-specific lint/typecheck/build |

### Review Phase
| File | Purpose |
|------|---------|
| `common/coding-standards.md` | Standards compliance check |

### Deliver Phase
| File | Purpose |
|------|---------|
| `common/git-conventions.md` | Commit and branch conventions |

---

## Tech-Stack Rule Index

Each technology stack follows the 4-file convention:

| Stack | Overview | Comments | Testing | Verification |
|-------|----------|----------|---------|--------------|
| **Java** | [overview.md](java/overview.md) | [comments.md](java/comments.md) | [testing.md](java/testing.md) | [verification.md](java/verification.md) |
| **NestJS** | [overview.md](nest/overview.md) | [comments.md](nest/comments.md) | [testing.md](nest/testing.md) | [verification.md](nest/verification.md) |
| **React** | [overview.md](react/overview.md) | [comments.md](react/comments.md) | [testing.md](react/testing.md) | [verification.md](react/verification.md) |
| **Vue** | [overview.md](vue/overview.md) | [comments.md](vue/comments.md) | [testing.md](vue/testing.md) | [verification.md](vue/verification.md) |
| **Go** | [overview.md](go/overview.md) | [comments.md](go/comments.md) | [testing.md](go/testing.md) | [verification.md](go/verification.md) |
| **Python** | [overview.md](python/overview.md) | [comments.md](python/comments.md) | [testing.md](python/testing.md) | [verification.md](python/verification.md) |
| **Rust** | [overview.md](rust/overview.md) | [comments.md](rust/comments.md) | [testing.md](rust/testing.md) | [verification.md](rust/verification.md) |
| **Frontend** (cross-framework) | [overview.md](frontend/overview.md) | [comments.md](frontend/comments.md) | [testing.md](frontend/testing.md) | [verification.md](frontend/verification.md) |
| **Backend** (cross-framework) | [overview.md](backend/overview.md) | [comments.md](backend/comments.md) | [testing.md](backend/testing.md) | [verification.md](backend/verification.md) |

---

## Common Rule Index

| File | Purpose | Applies To |
|------|---------|------------|
| [workflow.md](common/workflow.md) | Standard development workflow phases | All projects |
| [overview.md](common/overview.md) | High-level architectural principles | All projects |
| [coding-standards.md](common/coding-standards.md) | Universal coding conventions | All languages |
| [comments.md](common/comments.md) | Cross-language comment principles | All languages |
| [testing-standards.md](common/testing-standards.md) | Universal testing principles | All projects |
| [verification.md](common/verification.md) | Universal verification gates | All projects |
| [git-conventions.md](common/git-conventions.md) | Version control conventions | All projects |

---

## Skill Index

| Skill | Purpose | Related Rules | Related Agents |
|-------|---------|---------------|----------------|
| [coding-standards](../skills/coding-standards/SKILL.md) | Enforce code quality standards | `common/coding-standards.md` | `code-standards-enforcer` |
| [standard-dev-workflow](../skills/standard-dev-workflow/SKILL.md) | Orchestrate workflow phases | `common/workflow.md` | `workflow-orchestrator` |
| [testing-workflow](../skills/testing-workflow/SKILL.md) | Test planning and execution | `common/testing-standards.md` | `test-strategist` |
| [post-coding-verification](../skills/post-coding-verification/SKILL.md) | Run verification pipeline | `common/verification.md` | `quality-gate` |
| [ui-test-planning](../skills/ui-test-planning/SKILL.md) | UI-specific test strategies | `common/testing-standards.md`<br>`frontend/testing.md` | `test-strategist` |
| **Tech Patterns** | | | |
| [java-backend-patterns](../skills/java-backend-patterns/SKILL.md) | Java implementation patterns | `java/*.md` | `code-standards-enforcer` |
| [nest-patterns](../skills/nest-patterns/SKILL.md) | NestJS implementation patterns | `nest/*.md` | `code-standards-enforcer` |
| [react-patterns](../skills/react-patterns/SKILL.md) | React implementation patterns | `react/*.md` | `code-standards-enforcer` |
| [vue-patterns](../skills/vue-patterns/SKILL.md) | Vue implementation patterns | `vue/*.md` | `code-standards-enforcer` |
| [go-patterns](../skills/go-patterns/SKILL.md) | Go implementation patterns | `go/*.md` | `code-standards-enforcer` |
| [python-patterns](../skills/python-patterns/SKILL.md) | Python implementation patterns | `python/*.md` | `code-standards-enforcer` |
| [rust-service-patterns](../skills/rust-service-patterns/SKILL.md) | Rust implementation patterns | `rust/*.md` | `code-standards-enforcer` |

---

## Agent Index

| Agent | Phase | Responsibility | Trigger |
|-------|-------|----------------|---------|
| [workflow-orchestrator](../agents/workflow-orchestrator.md) | All | Coordinate phase transitions and agent invocation | Task start, phase completion |
| [code-standards-enforcer](../agents/code-standards-enforcer.md) | Code | Enforce naming, complexity, comments, security | Code phase entry |
| [test-strategist](../agents/test-strategist.md) | Test | Define test strategy, analyze coverage, identify gaps | Test phase entry |
| [quality-gate](../agents/quality-gate.md) | Verify | Run lint/typecheck/build/security verification | Verify phase entry |
| [stack-reviewer](../agents/stack-reviewer.md) | Review | Review cross-cutting concerns, rule-skill alignment | Review phase entry |

---

## Inheritance Reference

### Common → Tech-Stack Inheritance

```
common/coding-standards.md
    ├──► java/overview.md (Java-specific architecture)
    ├──► nest/overview.md (NestJS-specific architecture)
    ├──► react/overview.md (React-specific architecture)
    ├──► vue/overview.md (Vue-specific architecture)
    ├──► go/overview.md (Go-specific architecture)
    ├──► python/overview.md (Python-specific architecture)
    └──► rust/overview.md (Rust-specific architecture)

common/comments.md
    ├──► java/comments.md (JavaDoc conventions)
    ├──► nest/comments.md (TSDoc for NestJS)
    ├──► react/comments.md (JSDoc/TSDoc for React)
    ├──► vue/comments.md (SFC comment conventions)
    ├──► go/comments.md (Go doc conventions)
    ├──► python/comments.md (Docstring conventions)
    └──► rust/comments.md (rustdoc conventions)

common/testing-standards.md
    ├──► java/testing.md (JUnit 5 + Mockito)
    ├──► nest/testing.md (Jest + TestingModule)
    ├──► react/testing.md (Vitest + Testing Library)
    ├──► vue/testing.md (Vitest + Vue Test Utils)
    ├──► go/testing.md (testing + testify)
    ├──► python/testing.md (pytest)
    └──► rust/testing.md (#[test] + proptest)

common/verification.md
    ├──► java/verification.md (Checkstyle + SpotBugs)
    ├──► nest/verification.md (ESLint + tsc)
    ├──► react/verification.md (ESLint + typescript-eslint)
    ├──► vue/verification.md (ESLint + vue-tsc)
    ├──► go/verification.md (gofmt + golint + go vet)
    ├──► python/verification.md (black + pylint + mypy)
    └──► rust/verification.md (Clippy + rustfmt)
```

---

## Usage Guidelines

### For AI Assistants

1. **Always check common rules first** - Establish baseline principles
2. **Apply tech-stack rules second** - Override with specific implementations
3. **Reference workflow phases** - Ensure proper phase entry/exit
4. **Invoke appropriate agents** - Use agent capabilities for specialized tasks

### For Project Setup

1. **Identify your tech stack** - Find matching `{stack}/` directory
2. **Review all 4 files** - Understand complete requirements
3. **Check inheritance chain** - Review corresponding `common/` rules
4. **Configure verification tools** - Set up tools specified in `verification.md`

### For Rule Authors

1. **Common rules** - Define principles, not tools
2. **Tech-stack rules** - Reference common rules, specify tools
3. **Avoid duplication** - Link to common rules instead of repeating
4. **Keep files focused** - One concern per file (overview/comments/testing/verify)

---

## References

- [Rules README](README.md) - Architecture overview
- [Agents README](../agents/README.md) - Agent orchestration
- [Skills Directory](../skills/) - Task-specific capabilities
