# [Feature Name] Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development
> to implement this plan task-by-task.
> For frontend work, do not implement until design.md has complete
> Layout, Fields, Components, States, and Frontend Test Matrix sections
> with no unresolved `MISSING blocked:` UI-required field rows.

**Goal:** <!-- One sentence -->

**Architecture:** <!-- 2-3 sentences -->

**Tech Stack:** <!-- Key technologies -->

**Frontend Contract Gate:** <!-- PASS / MISSING blocked: <reason> -->

**Frontend Test Strategy:** <!-- unit/component/integration/E2E/browser/visual commands -->

---

## Task 1: Requirement and Field Contract Gate

- [ ] **Step 1:** Read specs, design.md, and the Fields table; list all UI-required fields touched by this task
- [ ] **Step 2:** Confirm each field has an OK source contract and no `MISSING blocked:` status
- [ ] **Step 3:** If any field is missing or ambiguous, stop and update design.md instead of coding

## Task 2: Component Reuse Gate

- [ ] **Step 1:** Search existing components, hooks/composables, utilities, and installed UI libraries
- [ ] **Step 2:** Confirm every UI unit is classified as `existing`, `wrap existing`, or `new`
- [ ] **Step 3:** For `wrap existing` or `new`, record inputs, outputs/events, states, accessibility, and reuse scope

## Task 3: RED-GREEN-REFACTOR Implementation

- [ ] **Step 1:** RED — add the smallest failing unit/component/integration/E2E test for the next behavior
- [ ] **Step 2:** GREEN — implement the smallest frontend change needed to pass
- [ ] **Step 3:** REFACTOR — simplify while preserving field contracts, component decisions, permissions, and states

## Task 4: Frontend Verification Evidence

- [ ] **Step 1:** Run the project-existing unit/component/integration commands
- [ ] **Step 2:** Run E2E/browser/visual smoke where applicable across desktop and mobile viewports
- [ ] **Step 3:** Record exit status, console/network conclusions, screenshots/log paths, and any `NOT RUN automated` reasons
