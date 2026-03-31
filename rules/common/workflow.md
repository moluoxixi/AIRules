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

#### MCP UI Verification (Optional)

Between Verify and Review phases, an optional MCP-based browser verification step may be triggered when all three conditions are met:

1. **UI Change Detected**: Task involves page/component creation, style changes, or interaction logic modifications
2. **MCP Available**: Environment has UI testing MCP tools (e.g., playwright, browser tools)
3. **Verify Passed**: All verification gates have passed

**Behavior:**
- Ask user in natural language: "All verification checks passed. Detected Playwright MCP is available in the current environment. Would you like to launch browser verification for the page effects?"
- No popups, no selection boxes—plain text conversation only
- **User responds positively** (e.g., "yes", "sure", "verify it") → Execute MCP browser verification
- **User continues with other topics or doesn't respond** → Skip and proceed to Review phase

**MCP Verification Scope:**
- Page rendering correctness (screenshot comparison)
- Critical user interaction flows (click, form input, navigation)
- Browser console logs (no errors or warnings)
- Responsive layout validation
- Network request verification

**Output:** Structured verification report with screenshots and logs

**Note:** This is NOT a standalone phase but an optional bridge between Verify and Review. It should never block the workflow.

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

| Phase | Rules Reference | Recommended Skills | Agent Roles |
|-------|----------------|-------------------|-------------|
| Design | `rules/common/overview.md` | Architecture, Domain modeling | - |
| Plan | `rules/common/overview.md` | `standard-dev-workflow`, Task breakdown, Estimation | - |
| Code | `rules/common/coding-standards.md`, `rules/common/comments.md`, Stack-specific rules | `coding-standards`, Language-specific patterns | frontend-dev / backend-dev / fullstack-dev |
| Test | `rules/common/testing-standards.md` | `testing-workflow`, TDD | - |
| Verify | `rules/common/verification.md` | `post-coding-verification`, CI/CD, Tooling | - |
| Review | `rules/common/overview.md` | Code review, Security review | `stack-reviewer` |
| Deliver | `rules/common/git-conventions.md` | Release management | - |

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
