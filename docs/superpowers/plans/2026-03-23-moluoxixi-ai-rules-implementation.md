# Moluoxixi AI Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable version of the `aiRules` repository with a `~/.moluoxixi` home layout, vendor mapping, link rebuild scripts, install/upgrade docs for Claude and Codex, and first-party rules and skills scaffolding.

**Architecture:** Keep upstream repositories in `~/.moluoxixi/vendors/`, expose selected third-party skills through a curated aggregation layer under `~/.moluoxixi/skills/`, keep first-party `rules/`, `skills/`, and `agents/` in this repository, and project the final layout into `~/.claude/`, `~/.codex/`, and `~/.agents/skills/`. Use small Node.js scripts for manifest-driven vendor sync and link rebuilding so the workflow stays cross-platform.

**Tech Stack:** Markdown, Node.js built-ins, JSON manifests, PowerShell/bash install docs.

---

### Task 1: Scaffold the repository structure

**Files:**
- Create: `d:/project/aiRules/README.md`
- Create: `d:/project/aiRules/package.json`
- Create: `d:/project/aiRules/.gitignore`
- Create: `d:/project/aiRules/manifests/vendors.json`
- Create: `d:/project/aiRules/rules/README.md`
- Create: `d:/project/aiRules/rules/common/overview.md`
- Create: `d:/project/aiRules/rules/frontend/overview.md`
- Create: `d:/project/aiRules/rules/backend/overview.md`
- Create: `d:/project/aiRules/rules/react/overview.md`
- Create: `d:/project/aiRules/rules/vue/overview.md`
- Create: `d:/project/aiRules/rules/nest/overview.md`
- Create: `d:/project/aiRules/rules/rust/overview.md`
- Create: `d:/project/aiRules/rules/java/overview.md`
- Create: `d:/project/aiRules/rules/testing/overview.md`
- Create: `d:/project/aiRules/skills/vue-patterns/SKILL.md`
- Create: `d:/project/aiRules/skills/nest-patterns/SKILL.md`
- Create: `d:/project/aiRules/skills/rust-service-patterns/SKILL.md`
- Create: `d:/project/aiRules/skills/java-backend-patterns/SKILL.md`
- Create: `d:/project/aiRules/skills/ui-test-planning/SKILL.md`
- Create: `d:/project/aiRules/agents/stack-reviewer.md`

- [ ] **Step 1: Add a small repository shape test**

```js
test('vendor manifest includes superpowers and external skill sources', () => {
  const manifest = JSON.parse(readFileSync('manifests/vendors.json', 'utf8'));
  assert.ok(manifest.vendors.superpowers);
  assert.ok(manifest.vendors.anthropicSkills);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/vendor-manifest.test.mjs`
Expected: FAIL because the manifest file and repository scaffold do not exist yet.

- [ ] **Step 3: Create the repository skeleton and seed content**

Add the repository metadata, vendor manifest, first-party rule directories, first-party custom skills, and a concise root README explaining the `~/.moluoxixi` architecture.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/vendor-manifest.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md package.json .gitignore manifests/vendors.json rules skills agents tests/vendor-manifest.test.mjs
git commit -m "feat: scaffold moluoxixi ai rules repository"
```

### Task 2: Build and test the vendor/link helper modules

**Files:**
- Create: `d:/project/aiRules/scripts/lib/vendors.mjs`
- Create: `d:/project/aiRules/scripts/lib/links.mjs`
- Create: `d:/project/aiRules/scripts/sync-vendors.mjs`
- Create: `d:/project/aiRules/scripts/rebuild-links.mjs`
- Test: `d:/project/aiRules/tests/link-builder.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
test('buildLinkPlan returns a superpowers namespace link and selected skill links', () => {
  const plan = buildLinkPlan(sampleManifest, 'C:/Users/demo/.moluoxixi');
  assert.equal(plan.some((entry) => entry.target.endsWith('/skills/superpowers')), true);
  assert.equal(plan.some((entry) => entry.target.endsWith('/skills/frontend-design')), true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/link-builder.test.mjs`
Expected: FAIL because the link helper module does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Implement:
- manifest loading
- target path expansion for `~/.moluoxixi`
- a deterministic link plan
- CLI wrappers for vendor sync and link rebuild

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/link-builder.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts tests/link-builder.test.mjs
git commit -m "feat: add vendor sync and link rebuild helpers"
```

### Task 3: Add Claude and Codex installation and upgrade documentation

**Files:**
- Create: `d:/project/aiRules/.claude/INSTALL.md`
- Create: `d:/project/aiRules/.claude/UPGRADE.md`
- Create: `d:/project/aiRules/.codex/INSTALL.md`
- Create: `d:/project/aiRules/.codex/UPGRADE.md`
- Create: `d:/project/aiRules/.codex/AGENTS.md`

- [ ] **Step 1: Write a failing doc coverage test**

```js
test('install docs mention superpowers-first flow and ~/.moluoxixi layout', () => {
  const codexInstall = readFileSync('.codex/INSTALL.md', 'utf8');
  assert.match(codexInstall, /superpowers/i);
  assert.match(codexInstall, /~\\/.moluoxixi/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/install-docs.test.mjs`
Expected: FAIL because the install docs do not exist yet.

- [ ] **Step 3: Write the minimal documentation**

Document:
- repo clone location
- vendor sync and link rebuild commands
- Claude sync flow
- Codex sync flow
- `~/.agents/skills/` exposure for Codex
- upgrade and verification commands

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/install-docs.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .claude .codex tests/install-docs.test.mjs
git commit -m "docs: add claude and codex install flows"
```

### Task 4: Verify the first usable repository state

**Files:**
- Modify: `d:/project/aiRules/package.json`

- [ ] **Step 1: Add a single verification script entry**

```json
{
  "scripts": {
    "test": "node --test tests/*.test.mjs"
  }
}
```

- [ ] **Step 2: Run the full verification suite**

Run: `npm test`
Expected: all repository tests PASS

- [ ] **Step 3: Run script help checks**

Run: `node scripts/sync-vendors.mjs --help`
Expected: prints usage and exits successfully

Run: `node scripts/rebuild-links.mjs --help`
Expected: prints usage and exits successfully

- [ ] **Step 4: Inspect the final tree**

Run: `Get-ChildItem -Recurse`
Expected: expected repository structure exists without accidental vendor clones committed into the repo

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "test: verify repository bootstrap flow"
```
