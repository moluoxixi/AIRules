# First-Party Skill Projection Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make first-party local `skills/` a flat source tree while routing all final skill artifacts through `vendor/skills` and projecting host-visible skill links from those vendor artifacts only.

**Architecture:** Treat first-party skills as a local vendor source described explicitly in the manifest, then use one unified pipeline to materialize `vendor/skills` for both first-party and third-party skills. Replace direct first-party skill copies into host homes with leaf-level symlink projection from `vendor/skills`, and document the source/artifact/projection contract so future changes keep the same model.

**Tech Stack:** Node.js ESM scripts, Node test runner, PowerShell host environment, filesystem symlinks/junctions

---

### Task 1: Lock the desired projection contract into tests

**Files:**
- Modify: `tests/vendor-manifest.test.mjs`
- Modify: `tests/link-builder.test.mjs`
- Modify: `tests/install-flow.test.mjs`
- Create: `tests/first-party-layout.test.mjs`

- [ ] **Step 1: Write the failing manifest and install assertions**

Add assertions that first-party skills are emitted through manifest-defined `vendor/skills/**` targets, while host-visible `skills/` links are leaf skill links rather than copied source directories.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `node --test tests/vendor-manifest.test.mjs tests/link-builder.test.mjs tests/install-flow.test.mjs tests/first-party-layout.test.mjs`
Expected: FAIL because first-party skills are not yet represented as local-vendor outputs and install flow still copies `skills/` directly.

- [ ] **Step 3: Add a regression test for flat first-party source layout**

Create a test fixture with a fake first-party skill under root `skills/<skill-name>` and assert nested first-party source directories are rejected or ignored according to the chosen implementation boundary.

- [ ] **Step 4: Re-run the focused tests to confirm the red state**

Run: `node --test tests/vendor-manifest.test.mjs tests/link-builder.test.mjs tests/install-flow.test.mjs tests/first-party-layout.test.mjs`
Expected: FAIL with the new assertions still unmet.

- [ ] **Step 5: Commit**

```bash
git add tests/vendor-manifest.test.mjs tests/link-builder.test.mjs tests/install-flow.test.mjs tests/first-party-layout.test.mjs
git commit -m "test: define first-party skill projection contract"
```

### Task 2: Route first-party and third-party skills through one artifact pipeline

**Files:**
- Modify: `constants/skills.js`
- Modify: `scripts/lib/vendors.mjs`
- Modify: `scripts/lib/links.mjs`
- Modify: `scripts/lib/install.mjs`

- [ ] **Step 1: Write the minimal manifest and install changes**

Add explicit first-party entries to the manifest, teach manifest loading and link planning how to resolve local first-party sources, and replace direct first-party skill copying with unified artifact generation into `vendor/skills`.

- [ ] **Step 2: Run the focused tests to verify the implementation is still incomplete**

Run: `node --test tests/vendor-manifest.test.mjs tests/link-builder.test.mjs tests/install-flow.test.mjs tests/first-party-layout.test.mjs`
Expected: At least one FAIL while the pipeline is only partially updated.

- [ ] **Step 3: Finish the projection implementation**

Update install helpers so:
- root `skills/` is treated as flat first-party source only
- `vendor/skills/**` is rebuilt for every source of truth
- host-visible `skills/` contains symlinks to leaf skills under `vendor/skills`
- duplicate leaf skill names are detected instead of silently overwritten

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `node --test tests/vendor-manifest.test.mjs tests/link-builder.test.mjs tests/install-flow.test.mjs tests/first-party-layout.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add constants/skills.js scripts/lib/vendors.mjs scripts/lib/links.mjs scripts/lib/install.mjs
git commit -m "feat: unify first-party and vendor skill projection"
```

### Task 3: Document the layout rules and update repository-facing guidance

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `README-zh.md`
- Modify: `docs/superpowers/specs/2026-04-02-skill-first-restructure-design.md`
- Create: `docs/architecture/skill-layout.md`

- [ ] **Step 1: Write the documentation changes**

Document the stable contract:
- root `skills/` is a flat first-party source tree
- `vendor/skills` is the only final artifact tree
- its nested classification comes from `constants/skills.js`
- host-visible skill entrypoints are built from `vendor/skills` leaf directories

- [ ] **Step 2: Run documentation and stale-reference tests**

Run: `node --test tests/install-docs.test.mjs tests/readme-positioning.test.mjs tests/no-stale-rule-references.test.mjs`
Expected: PASS once docs match the new contract.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md README-zh.md docs/superpowers/specs/2026-04-02-skill-first-restructure-design.md docs/architecture/skill-layout.md
git commit -m "docs: clarify first-party skill layout contract"
```
