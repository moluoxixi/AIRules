---
name: standard-dev-workflow
description: "Use when starting any new development task to orchestrate the complete workflow from design through delivery"
---

# Standard Development Workflow

## Overview

Master orchestration skill that sequences the complete development lifecycle: Design → Plan → Code → Test → Verify → Review → Deliver.

## When to Use

- Starting any new feature, bug fix, or refactoring task
- Unclear about which phase of development you're in
- Need to ensure no workflow phases are skipped

## Core Pattern

```
Design → Plan → Code → Test → Verify → Review → Deliver
```

### Phase Checklist & Transitions

| Phase | Entry Criteria | Exit Criteria | References |
|-------|---------------|---------------|------------|
| **Design** | Task assigned with objective | Requirements clear, approach validated | `rules/common/overview.md` |
| **Plan** | Design complete | Subtasks defined with deliverables | Task breakdown skill |
| **Code** | Plan approved | Implementation complete, self-reviewed | `coding-standards` skill, stack-specific rules |
| **Test** | Code complete | All tests pass, coverage met | `testing-workflow` skill |
| **Verify** | Tests passing | Lint/type/build/security pass | `post-coding-verification` skill |
| **Review** | Verification complete | Feedback addressed | Code review checklist |
| **Deliver** | Review approved | Merged/deployed, documented | `rules/common/git-conventions.md` |

### Rollback Rules

| Failed Phase | Action | Return To |
|-------------|--------|-----------|
| Verify | Fix immediately | Code or Verify |
| Test | Fix code/tests | Code |
| Review | Address feedback | Code |

## Related Rules

- `rules/common/workflow.md` - Complete workflow specification
- `rules/common/coding-standards.md` - Cross-language coding standards
- `rules/common/testing-standards.md` - Testing principles
- `rules/common/verification.md` - Quality gates
- `rules/common/git-conventions.md` - Commit and merge conventions

## Verification Requirements

- All 7 phases have clear entry/exit criteria
- No phase skipped without documented justification
- Rollback triggers are explicit and followed
