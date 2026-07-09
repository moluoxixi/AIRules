---
description: "Frontend task list template for Spec Kit + Superpowers bridge implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`

**Prerequisites**: plan.md (required), spec.md (required), research.md/data-model.md/contracts/quickstart.md when generated

**Execution**: Implement through `speckit-superpowers-bridge`, not direct `speckit.implement`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label from spec.md
- Include exact file paths in descriptions
- Tests that guard changed behavior come before implementation tasks

## Phase 1: Setup

- [ ] T001 Confirm package manager, frontend framework, and test runner from the real project files
- [ ] T002 Confirm AIRules projected skills and `speckit-superpowers-bridge` readiness
- [ ] T003 [P] Record actual frontend source, route, store, API client, and component directories

---

## Phase 2: Frontend Contract Gate (Blocking)

**Purpose**: Prevent UI work from inventing fields, components, states, or test evidence.

- [ ] T004 Compare every UI field in spec.md/plan.md against source contracts and update the Fields table
- [ ] T005 Mark absent or ambiguous UI-required fields as `MISSING blocked: <reason>`
- [ ] T006 Search existing components, hooks/composables, utilities, and UI libraries before adding UI units
- [ ] T007 Classify each UI unit as `existing`, `wrap existing`, or `new`
- [ ] T008 Complete loading, empty, error, disabled, success, permission-denied, and pending state decisions
- [ ] T009 Complete the Frontend Test Matrix using the `frontend-testing` discipline

**Checkpoint**: Stop if any field row is `MISSING blocked: <reason>`.

---

## Phase 3: User Story 1 - [Title] (Priority: P1)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 1

- [ ] T010 [P] [US1] Add failing unit/component test for [behavior] in [path]
- [ ] T011 [P] [US1] Add failing integration/E2E/browser test for [journey] in [path] when required by the Frontend Test Matrix

### Implementation for User Story 1

- [ ] T012 [P] [US1] Reuse or wrap [component] in [path] according to the Components table
- [ ] T013 [US1] Wire [field/source] from [API/store/route/permission/state path]
- [ ] T014 [US1] Implement state handling for loading/empty/error/disabled/success/permission-denied/pending
- [ ] T015 [US1] Run frontend verification commands and record viewport, console, network, screenshot, or log evidence

**Checkpoint**: User Story 1 works independently and all required evidence is recorded.

---

## Phase 4: Additional User Stories

Repeat the User Story 1 structure for US2/US3/etc. Keep stories independently testable and avoid cross-story hidden dependencies.

---

## Phase N: Polish & Cross-Cutting Concerns

- [ ] TXXX [P] Documentation updates in docs/ or project-local guides
- [ ] TXXX Code cleanup and refactoring after tests pass
- [ ] TXXX Accessibility and responsive review for changed UI
- [ ] TXXX Run quickstart.md validation when present
- [ ] TXXX Run bridge completion and verification before marking handoff complete

## Dependencies & Execution Order

- Setup precedes the frontend contract gate.
- The frontend contract gate blocks all implementation.
- Tests precede implementation for each story.
- Story implementation precedes polish and bridge completion.
- Bridge handoff is set to `blocked` when Spec Kit artifacts are incomplete or unsafe.
