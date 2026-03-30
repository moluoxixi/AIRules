# Common Workflow Standards

Standard development workflow applicable across all projects and technology stacks.

## Phase Overview

```
Design → Plan → Code → Test → Verify → Review → Deliver
```

## Phase Definitions

### 1. Design
- Define requirements and acceptance criteria
- Identify constraints and dependencies
- **Document Discovery** (for business application development)
  - Search for and review relevant business documents
  - API documentation (Swagger/OpenAPI, Apifox, Postman, `docs/api/`)
  - Requirements/PRD (Confluence, 飞书, 语雀, `docs/prd/`)
  - UI designs (Figma, MasterGo, Sketch, `docs/design/`)
  - Data models (`docs/db/`, ER diagrams)
  - Business process flows (state diagrams, flowcharts)
  - Technical specifications (`docs/tech/`, RFCs)
- Create/Update design documentation if needed

**Entry:** Task assigned with clear objective
**Exit:** Design approved, approach validated, required documents reviewed (or documented as unavailable)

### 2. Plan
- Break down into verifiable subtasks
- Estimate effort and identify risks
- Assign priorities to subtasks

**Entry:** Design complete
**Exit:** Task list with clear deliverables

### 3. Code
- Implement following stack-specific rules
- Apply common coding standards
- Add necessary comments per comment rules

**Entry:** Plan approved
**Exit:** Implementation complete, self-reviewed

### 4. Test
- Write tests following testing standards
- Execute test suite
- Fix failing tests

**Entry:** Code implementation complete
**Exit:** All tests pass, coverage targets met

### 5. Verify
- Run lint, type check, build
- Security scan dependencies
- Verify formatting consistency

**Entry:** Tests passing
**Exit:** All verification gates pass

### 6. Review
- Code review by peer or self-review checklist
- Verify against requirements
- Address feedback

**Entry:** Verification complete
**Exit:** Review approved, feedback resolved

### 7. Deliver
- Merge/Deploy per project conventions
- Update documentation
- Close task with summary

**Entry:** Review approved
**Exit:** Changes in production/main branch

## Rollback Rules

When a phase fails, follow this escalation:

| Failed Phase | Action | Return To |
|-------------|--------|-----------|
| Verify | Fix issues immediately | Code or Verify |
| Test | Fix code or update tests | Code |
| Review | Address all feedback | Code |
| Design | Re-evaluate approach | Design |

- Never bypass verification to meet deadlines
- Document why rollback was necessary
- Update plan if approach changes significantly

## Rule-Skill-Agent Mapping

| Phase | Rules Reference | Recommended Skills | Optional Agent Roles |
|-------|----------------|-------------------|---------------------|
| Design | `rules/common/overview.md` | Architecture, Domain modeling | Tech Lead |
| Plan | `rules/common/overview.md` | Task breakdown, Estimation | Project Manager |
| Code | `rules/common/coding-standards.md`, `rules/common/comments.md`, Stack-specific rules | Language-specific patterns | Senior Developer |
| Test | `rules/common/testing-standards.md` | Test planning, TDD | QA Engineer |
| Verify | `rules/common/verification.md` | CI/CD, Tooling | DevOps |
| Review | `rules/common/overview.md` | Code review, Security review | Tech Lead, Security |
| Deliver | `rules/common/git-conventions.md` | Release management | Release Manager |

## Uncertainty Handling

When requirements or implementation approach is unclear:

1. Consult existing rules and patterns first
2. Check similar implementations in codebase
3. Use available tools to gather information
4. Ask specific questions when information is insufficient

## Avoid

- Starting implementation without clear acceptance criteria
- Skipping verification phases due to time pressure
- Committing with known issues to "fix later"
- Bypassing code review for "small" changes
