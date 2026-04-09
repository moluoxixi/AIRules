# Skill-First Workflow Distribution Redesign

## Summary

This repository will move from a `rules-first` architecture to a `skills-first` architecture built on top of `superpowers`.

The new source of truth will be:

- upstream `superpowers` skills as the baseline workflow layer
- first-party skills written in the same style as `superpowers`
- vendor-managed external skills linked into the same `skills/` tree

The repository will stop using `rules/` as a normative layer. Existing rules are considered redundant with the desired skill-based workflow and will be removed as part of the migration.

This redesign is aimed at the primary target hosts:

- Codex
- Claude Code
- Qoder
- openCode

The user-preferred default workflow remains:

`requirements clarification -> solution/design -> implementation -> testing -> verification -> wrap-up`

## Context

The current repository extends `superpowers` with:

- first-party `rules/`
- first-party `agents/`
- vendor-managed third-party skills
- install and projection scripts for multiple hosts

That structure proved useful for establishing a baseline, but it now has two problems:

1. The first-party `rules/` content substantially overlaps with what should be expressed as executable, task-oriented skills.
2. Some target environments no longer benefit from, or do not reliably support, a global `rules` layer as the primary integration point.

The desired future state is not "rename rules to skills." It is a real shift in ownership:

- skills own behavioral guidance
- manifests own source and projection metadata
- hosts discover projected skills
- no separate first-party rule corpus remains

## Goals

- Make `skills/` the only normative source of workflow and development guidance.
- Keep `superpowers` as the process baseline rather than replacing it.
- Author first-party skills in a format and tone consistent with `superpowers`.
- Encode trigger conditions inside each skill instead of inventing a central orchestration layer.
- Preserve multi-host installation and projection for Codex, Claude Code, Qoder, and openCode.
- Reflect the user's preferred working style as the default repository behavior.

## Non-Goals

- Do not invent a central orchestrator service or manifest-driven policy engine.
- Do not preserve the existing `rules/` corpus as a parallel source of truth.
- Do not migrate every possible language or framework in the first pass.
- Do not fork or rewrite upstream vendor skills unless a deliberate fork is required later.

## Core Decisions

### 1. Skills Become the Only Source of Guidance

All first-party workflow and engineering guidance moves into `skills/`.

The repository will no longer maintain:

- cross-language rules in `rules/common/`
- stack-specific rules in `rules/{stack}/`
- catalog-style workflow mapping in `rules/CATALOG.md`

If compatibility scaffolding is needed during implementation, it should be temporary and removed within the same migration. The intended end state is that `rules/` is empty and non-essential.

### 2. First-Party Skills Follow the `superpowers` Model

Each first-party skill should be authored like a `superpowers` skill:

- YAML frontmatter with `name` and `description`
- clear overview and intent
- explicit "when to use" or equivalent trigger guidance
- hard gates where necessary
- concrete process instructions
- references to related or next-step skills when useful

Skills must be self-describing. Trigger logic should not depend on a separate central design document once the migration is complete.

### 3. No Separate Orchestrator

The system will not add a dedicated orchestrator component.

Instead, the repository will use a distributed composition model:

- each skill states when it applies
- each skill states its scope and boundaries in prose
- ordering is implicit through the workflow and skill relationships

This matches the way `superpowers` skills already work and avoids creating a second, heavier abstraction layer.

### 4. `standard-workflow` Becomes the First-Party Entry Skill

A first-party `standard-workflow` skill will define the default repository workflow:

`requirements clarification -> solution/design -> implementation -> testing -> verification -> wrap-up`

This skill does not own all technical detail. Its purpose is to:

- enforce the preferred phase order
- explain what type of skill should be used next
- connect repository behavior back to the `superpowers` baseline

### 5. Personal Preferences Are Isolated in `personal-defaults`

User-specific preferences should not be repeated across every technical skill.

A dedicated `personal-defaults` skill will hold the stable personal layer, such as:

- prefer clarifying requirements before implementation
- prefer skill-first behavior over global rules
- prefer concise, direct output
- prefer verification before completion claims

This skill should act as the final overlay rather than the primary technical skill.

### 6. Keep the Vendor Manifest Thin

`manifests/vendors.jsonc` should remain a source and projection manifest, not become a policy engine.

It should continue to answer questions like:

- which repositories are vendor sources
- where they are cloned
- which directories are linked into `skills/`

It should not become the canonical place for:

- workflow phase logic
- trigger conditions
- skill conflict resolution rules

Those belong in skill content.

### 7. Host Projection Must Match the New Reality

Install and projection logic must stop presenting the repository as `rules + skills + agents`.

After migration:

- Claude Code should project `skills/` and `agents/`, not `rules/`
- Qoder should project `skills/` and `agents/`, not `rules/`
- Codex should expose the aggregated skills under a first-party namespace that reflects this repository, not as a misleading `superpowers` alias
- openCode support should be added as a host-facing installation entry if the host supports the same projected model

## Target Repository Shape

```text
AIRules/
├─ vendor/
│  ├─ repos/               # cloned remote vendor repositories
│  └─ skills/              # classified final artifact tree
│     ├─ common/
│     ├─ frontend/
│     └─ superpowers/
├─ scripts/
├─ agents/
├─ .claude/
├─ .codex/
├─ .qoder/
├─ .opencode/
├─ tests/
├─ README.md
└─ package.json
```

## Source / Artifact / Projection Contract

- `constants/skills.js` maps remote vendor sources into classified targets under `vendor/skills/`.
- `vendor/skills/` is the only final artifact tree.
- `~/.moluoxixi/skills/` is a flattened host-facing projection built from leaf skill directories under `vendor/skills/`.
- Duplicate projected leaf skill names must fail fast instead of being silently overwritten.

## First-Party Skill Set

The first migration wave should establish these first-party skills.

### `standard-workflow`

Purpose:

- define the default phase order
- instruct the assistant to clarify first
- hand off conceptually to planning, implementation, testing, verification, and wrap-up

This is the behavioral entry point for the repository.

### `personal-defaults`

Purpose:

- express user-specific working preferences
- shape tone, directness, verification expectations, and completion behavior
- remain narrow enough to avoid becoming a duplicate technical ruleset

### `frontend`

Purpose:

- capture cross-framework frontend concerns
- component/page boundaries
- state placement
- loading, empty, and error states
- interaction completeness

Must not repeat framework-specific React or Vue details.

### `backend`

Purpose:

- capture cross-stack backend concerns
- API boundaries
- service responsibilities
- validation and error handling
- side-effect and persistence boundaries

Must not become a Nest-, Java-, or Python-specific skill.

### `javascript`

Purpose:

- cover JavaScript-specific implementation guidance
- async handling
- module boundaries
- runtime safety
- readable transformations and error surfaces

### `typescript`

Purpose:

- cover TypeScript-specific type design
- avoid `any`
- define boundary types
- model invalid states out of existence where possible

This skill should extend and refine `javascript`, not duplicate it.

### `react`

Purpose:

- React and Next.js component and hook guidance
- server/client boundaries where relevant
- component composition and state ownership

Must rely on `frontend` and `typescript` instead of restating their general guidance.

### `vue`

Purpose:

- Vue and Nuxt component organization
- Composition API usage
- composable boundaries
- state/store decisions

Must rely on `frontend` and `typescript` instead of restating their general guidance.

### `testing`

Purpose:

- express repository-specific testing expectations
- complement `superpowers/test-driven-development`
- emphasize behavior-focused tests and sensible mocking boundaries

### `verification`

Purpose:

- express repository-specific verification expectations
- complement `superpowers/verification-before-completion`
- define what "verified" means in this distribution

### `wrap-up`

Purpose:

- define completion and delivery behavior
- summarize changes, remaining risks, and next-step expectations
- align with review and branch-finishing skills where appropriate

## Skill Composition Model

The intended conceptual layering is:

`standard-workflow`
`-> domain skill`
`-> language skill`
`-> framework skill`
`-> phase skill`
`-> personal-defaults`

Examples:

- React + TypeScript UI task:
  `standard-workflow -> frontend -> typescript -> react -> testing/verification/wrap-up -> personal-defaults`
- Vue + TypeScript page task:
  `standard-workflow -> frontend -> typescript -> vue -> testing/verification/wrap-up -> personal-defaults`

This layering is descriptive, not enforced by a separate orchestrator artifact. The skills themselves should explain when they apply and what they assume.

## Skill Authoring Contract

Each first-party skill should be structured so that a host can discover it naturally and a model can apply it without extra metadata files.

Minimum structure:

```text
skills/<skill-name>/
└─ SKILL.md
```

Optional structure:

```text
skills/<skill-name>/
├─ SKILL.md
├─ references/
└─ templates/
```

Recommended `SKILL.md` shape:

1. frontmatter: `name`, `description`
2. overview
3. when to use
4. hard gates or non-negotiable rules, only where justified
5. process or decision guidance
6. boundaries: what the skill does not own
7. related skills or next-step handoff

This keeps the authoring style aligned with `superpowers` instead of introducing a repository-specific format.

## Installation and Projection Design

### Current Problem

Current install documentation and projection scripts still assume a first-party `rules/` layer exists and should be projected into host homes.

### Target Behavior

`~/.moluoxixi/skills` becomes the main projected asset.

The installation contract is:

- sync vendor repositories into `~/.moluoxixi/vendor/repos/*`
- rebuild the classified artifact tree in `~/.moluoxixi/vendor/skills`
- project flattened host-facing leaf skill entrypoints into `~/.moluoxixi/skills`

Target projections:

- Claude Code:
  - `~/.claude/skills -> ~/.moluoxixi/skills`
  - `~/.claude/agents -> ~/.moluoxixi/agents`
- Qoder:
  - `~/.qoder/skills -> ~/.moluoxixi/skills`
  - `~/.qoder/agents -> ~/.moluoxixi/agents`
- Codex:
  - copy `.codex/AGENTS.md`
  - expose `~/.moluoxixi/skills` through `~/.agents/skills/<first-party-namespace>`
- openCode:
  - add a host-facing installation path and projection instructions during implementation once the supported entry pattern is confirmed

### Namespace Note

Codex should stop projecting the full aggregated skill tree as `superpowers`. That name is misleading once the directory contains both upstream and first-party skills.

A first-party namespace such as `moluoxixi` is preferred.

## Agents

Agents may remain in the repository, but they are no longer the primary mechanism for encoding workflow standards.

Their role becomes optional support:

- parallel or specialized execution
- host-specific delegation helpers
- review helpers where appropriate

They should not be required in order to understand the repository's workflow expectations.

## Migration Strategy

This redesign will use a hard-cut outcome, but a disciplined internal sequence.

### Phase 1: Establish First-Party Skills

Create the first-party skill directories and write their initial `SKILL.md` files.

Priority order:

1. `standard-workflow`
2. `personal-defaults`
3. `frontend`
4. `backend`
5. `javascript`
6. `typescript`
7. `react`
8. `vue`
9. `testing`
10. `verification`
11. `wrap-up`

### Phase 2: Update Install and Host Projection

Refactor install scripts and host docs to describe the repository as:

- first-party skills
- vendor skills
- optional agents

Remove rules projection assumptions.

### Phase 3: Remove `rules/`

Once the first-party skills and host projection changes are in place, remove the existing `rules/` content in the same implementation cycle.

No long-term dual-source period should remain.

### Phase 4: Update Documentation and Tests

Update:

- repository README
- host install docs
- install and projection tests
- manifest-related tests where namespace assumptions changed

All repository references should describe the new `skills-first` model.

## Error Handling and Compatibility Considerations

### Broken References

Risk:

- install docs and tests currently refer to `rules/`
- host projections currently create `rules` links

Mitigation:

- remove or update all such references in the same migration
- do not delete `rules/` without updating projection code first

### Namespace Drift

Risk:

- Codex currently discovers the aggregated tree under the `superpowers` alias

Mitigation:

- change the projected namespace during the same migration
- update installation docs and tests to assert the new namespace explicitly

### Host Differences

Risk:

- host support for projected paths is not identical

Mitigation:

- keep first-party skill format host-agnostic
- keep host-specific logic in install docs and scripts only
- confirm openCode projection details during implementation before finalizing host docs

## Testing and Verification Expectations

The migration should be considered complete only when:

- install tests reflect the absence of `rules/` projections
- link-building tests reflect the intended skill namespace
- documentation tests no longer require `rules-first` content
- resulting install flow still produces a usable aggregated `skills/` tree

Verification should focus on:

- filesystem projection behavior
- namespace correctness
- documentation accuracy
- absence of stale rule references

## Acceptance Criteria

- First-party guidance exists in `skills/`, not `rules/`
- `rules/` is removed as a normative layer
- first-party skills follow a `superpowers`-style structure
- `standard-workflow` reflects the approved preferred workflow
- `personal-defaults` isolates user-specific behavior
- technical skills are split into domain, language, framework, and phase concerns
- install scripts and host docs no longer depend on projecting `rules/`
- Codex uses a first-party namespace instead of projecting everything as `superpowers`
- repository docs describe the project as a multi-host, skill-first workflow distribution

## Chosen Direction

This redesign adopts the hard-cut `skills-first` approach.

The repository will be positioned as:

`a superpowers-based, multi-host personal AI workflow distribution`

It will keep `superpowers` as the baseline process layer, replace first-party rules with first-party skills, and make projected skills the central integration surface across hosts.
