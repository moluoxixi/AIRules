# Moluoxixi Codex Skills Layer

## Installed Surface

When Codex is installed from this repository, treat these paths as the active host-facing surface:

- `~/.agents/skills/moluoxixi/` is the shared skill namespace for this repository
- `~/.moluoxixi/skills/` is the source tree projected into that namespace
- `~/.moluoxixi/agents/` is an optional companion layer for hosts that support projected agents
- `~/.codex/AGENTS.md` is the Codex-specific guidance file copied from this repository

Treat this install as skills-first from the projected namespace and first-party skill layering.

## First-Party Skill Layering

Use the first-party skills in this rough order:

1. `standard-workflow` establishes the default delivery flow.
2. `personal-defaults` applies repository-wide working preferences.
3. Choose the domain layer: `frontend` or `backend`.
4. Add the language and framework layer you need, such as `javascript`, `typescript`, `react`, or `vue`.
5. Close with the phase skills: `testing`, `verification`, and `wrap-up`.

These first-party skills live under `~/.agents/skills/moluoxixi/` alongside linked vendor skills.

## First-Party And Vendor Relationship

- First-party skills provide the repository's opinionated workflow and engineering guidance.
- `superpowers/*` remains the first-party-adjacent process layer for structured planning, TDD, debugging, review, and verification flows.
- Other vendor skills are available through the same namespace when their vendor repositories are installed and linked.

## Working Guidance

- Start from the installed namespace at `~/.agents/skills/moluoxixi/` instead of assuming a global `superpowers` alias.
- Prefer the first-party layering above before reaching for narrower host-specific guidance.
- Use `~/.moluoxixi/skills/` as the editable source of truth, then rerun install or upgrade so the projected namespace stays fresh.
- If agents are present for other hosts, keep them conceptually separate from Codex's skill namespace.

## Verification

Before claiming install or upgrade work is complete:

- Verify `~/.agents/skills/moluoxixi/` resolves to `~/.moluoxixi/skills/`
- Verify the first-party skills you expect are present in that namespace
- Verify `~/.codex/AGENTS.md` was copied from `~/.moluoxixi/.codex/AGENTS.md`
- Verify the host guidance still describes the skills-first model
