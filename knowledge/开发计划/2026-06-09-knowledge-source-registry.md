# Knowledge Source Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an industry-aligned knowledge source registry and evidence contract so AIRules can retrieve registered filesystem knowledge without forcing users into a single docs template.

**Architecture:** AIRules will treat registered knowledge sources as the search boundary, not arbitrary project files. A verifier script will validate source registry structure, forbidden paths, filesystem source requirements, and evidence contract statuses; skills and docs will route retrieval through the registry and keep formal docs as optional canonical outputs.

**Tech Stack:** Node.js ESM scripts, Vitest, Markdown skills, JSON registry.

---

## Task 1: Knowledge Source Registry Validation

**Files:**
- Create: `tests/knowledge-sources.test.ts`
- Create: `scripts/verify-knowledge-sources.mjs`

- [ ] **Step 1: Write failing registry validation tests**

Add tests for a valid registry, forbidden filesystem paths, missing owner, invalid source type, and rejection of unsupported non-filesystem source types.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/knowledge-sources.test.ts`

Expected: FAIL because `scripts/verify-knowledge-sources.mjs` does not exist.

- [ ] **Step 3: Implement minimal registry verifier**

Implement a Node ESM script that accepts registry JSON files, validates required fields, rejects forbidden include roots, and prints `PASS knowledge sources are valid`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/knowledge-sources.test.ts`

Expected: PASS.

## Task 2: Evidence Contract Validation

**Files:**
- Create: `tests/knowledge-search-contract.test.ts`
- Extend: `scripts/verify-knowledge-sources.mjs`

- [ ] **Step 1: Write failing evidence contract tests**

Add tests for allowed statuses, missing sources on `PASS`, source conflicts requiring `MISSING conflict`, and valid `MISSING evidence`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/knowledge-search-contract.test.ts`

Expected: FAIL because evidence report validation is not implemented.

- [ ] **Step 3: Implement minimal evidence report validation**

Extend the script with `--evidence <file>` support and validate evidence report status/source rules.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/knowledge-search-contract.test.ts`

Expected: PASS.

## Task 3: Skill And Architecture Documentation

**Files:**
- Create: `skills/knowledge-search/SKILL.md`
- Modify: `constants/skills.ts`
- Modify: `skills/init-project/references/common/docs.md`
- Modify: `skills/init-project/SKILL.md`
- Create: `knowledge/架构/decisions/ADR-0001-knowledge-source-registry.md`
- Modify: `knowledge/架构/decisions/index.md`
- Modify: `knowledge/架构/index.md`
- Modify: `knowledge/index.md`

- [ ] **Step 1: Write skill and docs contract**

Add the retrieval skill, document the registry/evidence model, and update existing docs guidance to prefer registered filesystem sources before standard docs.

- [ ] **Step 2: Validate skill frontmatter**

Run: `node scripts/verify-skill-frontmatter.mjs --root skills/knowledge-search`

Expected: PASS.

## Task 4: Final Verification

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run targeted tests**

Run:
- `npx vitest run tests/knowledge-sources.test.ts tests/knowledge-search-contract.test.ts`
- `node scripts/verify-skill-frontmatter.mjs --root skills/knowledge-search`
- `npm run lint:check`
- `npm run typecheck`
- `git diff --check`

Expected: all PASS.
