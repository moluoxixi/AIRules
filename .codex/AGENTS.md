# Moluoxixi Codex Rules

## Role Layering

When working in a Codex environment that has been installed from this repository:

1. Treat `superpowers` as the default workflow layer for planning, debugging, TDD, and verification.
2. Treat `~/.moluoxixi/rules/` as the first-party stack guidance layer with layered inheritance:
   - `common/` - Cross-language principles (workflow, coding standards, testing, verification)
   - `{tech-stack}/` - Implementation-specific rules (java/, react/, vue/, nest/, etc.)
3. Treat first-party and vendored skills exposed through `~/.agents/skills/superpowers/` as task-specific depth.
4. Treat agents in `~/.moluoxixi/agents/` as specialized workflow orchestrators.

## Standard Development Workflow

The rules define a 7-phase workflow:

```
Design → Plan → Code → Test → Verify → Review → Deliver
```

Each phase has corresponding rules, skills, and agents:

| Phase | Rules | Skills | Agents |
|-------|-------|--------|--------|
| Design | `common/workflow.md` | brainstorming (vendor) | - |
| Plan | `common/workflow.md` | superpowers/writing-plans (vendor) | - |
| Code | `common/coding-standards.md` → `{stack}/overview.md` | frontend-design (vendor, if UI) | frontend-dev / backend-dev / fullstack-dev |
| Test | `common/testing-standards.md` → `{stack}/testing.md` | superpowers/test-driven-development (vendor), webapp-testing (vendor) | - |
| Verify | `common/verification.md` → `{stack}/verification.md` | superpowers/verification-before-completion (vendor) | - |
| Review | `common/coding-standards.md` | code-reviewer (vendor) | stack-reviewer |
| Deliver | `common/git-conventions.md` | pr-creator (vendor) | - |

## First-Party Agents

- `frontend-dev` - Frontend development (Vue, React, Next.js)
- `backend-dev` - Backend development (Java, NestJS, Go, Python, Rust)
- `fullstack-dev` - Full-stack development spanning both layers
- `stack-reviewer` - Review cross-cutting concerns, rule-skill alignment

See `~/.moluoxixi/agents/README.md` for agent orchestration details.

## Installed External Skills

The install flow may expose these third-party skills when their vendor repositories are present:

- `frontend-design` - High-quality frontend visual and interface design
- `webapp-testing` - Playwright-based local web app testing
- `cache-components` - Next.js Cache Components / PPR practices
- `code-reviewer` - Code review and risk checking
- `pr-creator` - Generate PRs following repository templates
- `fix` - Fix lint, format, and common build issues
- `update-docs` - Update documentation and descriptions
- `find-skills` - Help discover installable skills
- `fullstack-developer` - Modern web full-stack development support

## Source Of Truth

- Do not edit files inside `~/.moluoxixi/vendors/` unless you intentionally want to fork an upstream source.
- Edit first-party rules, skills, agents, and docs in `~/.moluoxixi/`.
- Re-run the install or upgrade flow after first-party changes so `~/.agents/skills/superpowers/` stays in sync.
- See `~/.moluoxixi/rules/CATALOG.md` for complete rule-skill-agent mapping and inheritance reference

## Conflict Resolution

If guidance overlaps, resolve in this priority (highest to lowest):

1. **User instructions** win over all.
2. **Repository-local project instructions** win over global rules.
3. **Tech-stack rules** (`{stack}/`) win for implementation-specific guidance.
4. **Common rules** (`common/`) win for cross-language principles.
5. **`superpowers`** process skills win for workflow discipline.
6. **Vendor skills** provide additional capabilities.
7. **Default behavior** is the baseline.

See `~/.moluoxixi/rules/CATALOG.md` for detailed inheritance mapping.

## Verification

Before claiming completion:

- Run the relevant tests or checks
- Verify linked skills still exist if install-related files changed
- Verify `~/.codex/AGENTS.md` and `~/.agents/skills/superpowers/` are still aligned with the repository layout
- Follow the standard workflow phases (Design → Plan → Code → Test → Verify → Review → Deliver)
- Reference `~/.moluoxixi/rules/CATALOG.md` for rule-skill-agent alignment
