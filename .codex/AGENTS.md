# Moluoxixi Codex Rules

## Role Layering

When working in a Codex environment that has been installed from this repository:

1. Treat `superpowers` as the default workflow layer for planning, debugging, TDD, and verification.
2. Treat `~/.moluoxixi/rules/` as the first-party stack guidance layer.
3. Treat first-party and vendored skills exposed through `~/.agents/skills/superpowers/` as task-specific depth.

## Preferred Workflow

- Use `superpowers` skills first for process:
  - brainstorming
  - writing-plans
  - test-driven-development
  - verification-before-completion
- Then use Moluoxixi stack skills for implementation detail:
  - `vue-patterns`
  - `nest-patterns`
  - `rust-service-patterns`
  - `java-backend-patterns`
  - `ui-test-planning`

## Installed External Skills

The install flow may expose these third-party skills when their vendor repositories are present:

- `frontend-design`
- `webapp-testing`
- `cache-components`
- `code-reviewer`
- `pr-creator`
- `fix`
- `update-docs`
- `find-skills`
- `fullstack-developer`

## Source Of Truth

- Do not edit files inside `~/.moluoxixi/vendors/` unless you intentionally want to fork an upstream source.
- Edit first-party rules, skills, agents, and docs in `~/.moluoxixi/`.
- Re-run the install or upgrade flow after first-party changes so `~/.agents/skills/superpowers/` stays in sync.

## Conflict Resolution

If guidance overlaps:

1. User instructions win.
2. Repository-local project instructions win over global rules.
3. `superpowers` process skills win for workflow discipline.
4. Moluoxixi stack rules win for stack-specific implementation guidance.

## Verification

Before claiming completion:

- run the relevant tests or checks
- verify linked skills still exist if install-related files changed
- verify `~/.codex/AGENTS.md` and `~/.agents/skills/superpowers/` are still aligned with the repository layout
