# Moluoxixi AI Rules Design

## Goal

Build a personal AI rules repository on top of `https://github.com/obra/superpowers.git` that:

- installs `superpowers` first
- layers custom `rules`, `skills`, `agents`, and install/update docs on top
- supports both Claude and Codex
- reuses external high-value skills through clone-based vendor installs when possible
- keeps the final on-disk structure stable under `~/.moluoxixi/`

## Requirements

The repository must satisfy these user requirements:

- include Claude install and upgrade docs modeled after:
  - `https://raw.githubusercontent.com/dacheng-gao/ai/main/.claude/INSTALL.md`
  - `https://raw.githubusercontent.com/dacheng-gao/ai/main/.claude/UPGRADE.md`
- include Codex install and upgrade docs modeled after:
  - `https://raw.githubusercontent.com/dacheng-gao/ai/main/.codex/INSTALL.md`
  - `https://raw.githubusercontent.com/dacheng-gao/ai/main/.codex/UPGRADE.md`
- add global rules such as `.codex/AGENTS.md`
- expand beyond `superpowers` with frontend, backend, UI testing, page building, Vue, React, Rust, NestJS, Java, and similar common stacks
- if a useful skill/rule already exists upstream, install and update it via `git clone` and `git pull`
- if it does not exist upstream, implement it in this repository and make it installable and upgradable through the same repository-level workflow

## Reference Inputs

The design is informed by:

- `obra/superpowers` for the base workflow and Codex skill-link model
- `affaan-m/everything-claude-code` for layered `rules/`, richer `agents/`, installer ideas, and language coverage
- Trae's "Top 10 recommended skills" page for candidate external skills worth vendoring:
  - `frontend-design`
  - `cache-components`
  - `fullstack-developer`
  - `frontend-code-review`
  - `code-reviewer`
  - `webapp-testing`
  - `pr-creator`
  - `fix`
  - `update-docs`
  - `find-skills`

## Approaches Considered

### Approach A: Monorepo mirror

Copy all third-party skills and rules into this repository and distribute one flattened bundle.

Pros:

- simplest runtime layout
- no extra clone step during install

Cons:

- hard to upgrade safely
- creates provenance and maintenance problems
- invites conflicts between upstream updates and local customizations

### Approach B: Vendor clones plus flattened export

Clone upstream repositories into a vendor directory, then flatten all desired artifacts directly into one final `skills/` or `rules/` directory.

Pros:

- preserves upstream provenance
- upgrades can use `git pull`

Cons:

- flattening breaks relative references in layered rule systems
- name collisions become likely
- difficult to understand where a final file came from

### Approach C: Vendor clones plus aggregation layer

Clone upstream repositories into `~/.moluoxixi/vendors/`, expose only selected artifacts through curated links in `~/.moluoxixi/skills`, `~/.moluoxixi/agents`, and keep first-party rules directly in `~/.moluoxixi/rules`.

Pros:

- clean provenance and upgrade path
- avoids flattening conflicts
- lets local rules coexist with upstream skills
- easy to add or remove external sources later

Cons:

- installer is slightly more complex
- requires platform-aware link creation on Windows and Unix

## Chosen Approach

Choose Approach C.

This gives the repository a stable public surface under `~/.moluoxixi/`, while keeping upstream sources isolated in `~/.moluoxixi/vendors/`. It also matches the user's requested sequence: install `superpowers` first, then layer additional rules and linked skills on top.

## Final Directory Model

```text
~/.moluoxixi/
  vendors/
    superpowers/
    anthropic-skills/
    vercel-skills/
    gemini-skills/
    react-skills/
    awesome-llm-apps/
  rules/
    common/
    frontend/
    backend/
    react/
    vue/
    nest/
    rust/
    java/
    testing/
  skills/
    superpowers -> ~/.moluoxixi/vendors/superpowers/skills
    frontend-design -> ~/.moluoxixi/vendors/anthropic-skills/skills/frontend-design
    webapp-testing -> ~/.moluoxixi/vendors/anthropic-skills/skills/webapp-testing
    update-docs -> ~/.moluoxixi/vendors/vercel-skills/update-docs
    code-reviewer -> ~/.moluoxixi/vendors/gemini-skills/code-reviewer
    pr-creator -> ~/.moluoxixi/vendors/gemini-skills/pr-creator
    fix -> ~/.moluoxixi/vendors/react-skills/fix
    fullstack-developer -> ~/.moluoxixi/vendors/awesome-llm-apps/fullstack-developer
    find-skills -> ~/.moluoxixi/vendors/vercel-labs-skills/find-skills
    <first-party custom skills>
  agents/
    <first-party agents>
  hooks/
    <first-party hooks if added later>
```

## Platform Exposure Model

The repository will maintain a single canonical content root under `~/.moluoxixi/`, then project that into platform-native locations.

### Claude

- copy or sync first-party files into:
  - `~/.claude/CLAUDE.md`
  - `~/.claude/AGENTS.md`
  - `~/.claude/rules/`
  - `~/.claude/skills/`
  - `~/.claude/agents/`
- preserve user-owned `settings.json`
- use clone-and-sync install docs similar to the referenced `INSTALL.md` and `UPGRADE.md`

### Codex

- install `superpowers` exactly as recommended upstream
- maintain first-party Codex files under:
  - `~/.codex/AGENTS.md`
  - `~/.codex/rules/`
  - `~/.codex/skills/`
  - `~/.codex/agents/`
- also expose skills through Codex-native discovery under:
  - `~/.agents/skills/`
- keep `superpowers` available as a dedicated linked namespace

## Linking Strategy

Use symlink or junction creation only in aggregation layers, not in vendor sources.

Rules:

- `vendors/` always contains real git working copies
- `~/.moluoxixi/skills/` may contain links to vendor skill directories
- `~/.claude/skills/` and `~/.codex/skills/` are synchronized from `~/.moluoxixi/skills/`
- `~/.agents/skills/` exposes the final Codex-visible skill directories
- avoid flattening `rules/` from third-party sources with relative references

Windows support:

- prefer junctions for directories where needed
- prefer PowerShell-friendly creation commands plus `cmd /c mklink /J` fallback

Unix support:

- prefer `ln -sfn`

## Source Ownership Rules

### Upstream-managed

These should be installed via clone/pull and linked into the final structure:

- `superpowers`
- selected external skills from Anthropic, Vercel, Gemini, Facebook, and other upstreams

### First-party managed in this repository

These should live directly in this repository and be synced into `~/.moluoxixi/`:

- custom install and upgrade docs
- root `README.md`
- `.claude/INSTALL.md`
- `.claude/UPGRADE.md`
- `.codex/INSTALL.md`
- `.codex/UPGRADE.md`
- `.codex/AGENTS.md`
- optional `CLAUDE.md` or `AGENTS.md` templates for global behavior
- all custom rules for:
  - frontend
  - backend
  - UI testing
  - page authoring
  - React
  - Vue
  - NestJS
  - Rust
  - Java
- custom skills not available upstream
- custom agents if needed

## Install Flow

### Claude install

1. Clone this repository into a local working copy.
2. Ensure `~/.moluoxixi/` directories exist.
3. Clone or update `superpowers` into `~/.moluoxixi/vendors/superpowers`.
4. Clone or update any selected external skill sources into `~/.moluoxixi/vendors/...`.
5. Rebuild the aggregation layer under `~/.moluoxixi/skills`.
6. Sync first-party `rules`, `agents`, and docs into `~/.moluoxixi/`.
7. Sync the final result into `~/.claude/`.

### Codex install

1. Clone this repository into a local working copy.
2. Ensure `~/.moluoxixi/` directories exist.
3. Clone or update `superpowers` into `~/.moluoxixi/vendors/superpowers`.
4. Clone or update any selected external skill sources into `~/.moluoxixi/vendors/...`.
5. Rebuild the aggregation layer under `~/.moluoxixi/skills`.
6. Sync first-party `rules`, `agents`, and docs into `~/.moluoxixi/`.
7. Sync the final result into `~/.codex/`.
8. Rebuild or refresh `~/.agents/skills/` links for Codex discovery.

## Upgrade Flow

Upgrade docs should use the same structure as install docs, but:

- pull this repository first
- pull each vendor repository second
- rebuild links and aggregation layer third
- sync `~/.moluoxixi/` into `~/.claude/` and `~/.codex/` last

## Initial Implementation Scope

Phase 1 should deliver:

- repository skeleton
- install and upgrade docs for Claude and Codex
- a vendor manifest or mapping document
- first-party rules scaffold for the target stacks
- first-party global `AGENTS.md` for Codex
- helper scripts to rebuild vendor links
- a `README.md` explaining the architecture

Phase 2 can add:

- richer agents
- optional hooks
- selective installer profiles
- validation scripts

## Risks And Mitigations

### Risk: name collisions across third-party skills

Mitigation:

- maintain a curated vendor mapping
- allow namespaced or aliased final link names

### Risk: broken links after upgrades

Mitigation:

- provide a rebuild-links step in install and upgrade docs
- include verification commands

### Risk: rule layering conflicts

Mitigation:

- keep first-party rules authoritative
- do not flatten third-party layered rule systems into the same directory tree

### Risk: Windows link permissions

Mitigation:

- prefer junctions for directory exposure
- document administrator fallback only when required

## Open Questions

The design assumes:

- `~/.moluoxixi/` is the canonical home directory root
- `superpowers` stays as a dedicated linked skill namespace instead of being exploded into individual first-party copies
- third-party skills are curated selectively, not imported wholesale

If those assumptions remain correct, implementation can begin from this design without reworking the storage model.
