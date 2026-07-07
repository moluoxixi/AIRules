# [Feature Name] Implementation Plan

> **For agentic workers:** Use subagent-driven-development
> to implement this plan task-by-task.

**Goal:** <!-- One sentence -->

**Architecture:** <!-- 2-3 sentences -->

**Tech Stack:** <!-- Key technologies -->

**change_unit_id:** `CU-<change-unit>`

**Source Refs:** <!-- PRD/story/intake/proposal refs, or N/A -->

**Scenario IDs:** <!-- SCN-<capability>-<NNN> list covered by this plan -->

## Frontend Planning Notes

<!--
Only fill when the implementation includes frontend UI work. For pure backend,
data, infra, or docs changes, write: N/A — no frontend UI work.

This section supplements frontend tasks with implementation facts. It does not
decide task split or execution order.
-->

### Layout

<!-- Page/route, regions, responsive behavior, workflow entry/exit. -->

### Fields

| Field | Purpose | Display Form | Data Source | API Available | Gap |
|---|---|---|---|---|---|
| `<field>` | `<purpose>` | `<plain text / formatter / existing component / new wrapper / input control>` | `<api/store/derived/static>` | `<yes/no/derived/not needed>` | `<none or MISSING blocked: reason>` |

### Components

| Component | Existing / New | Used For | Source / Target Path | Notes |
|---|---|---|---|---|
| `<component>` | `<existing/new wrapper/new>` | `<usage>` | `<path/package>` | `<notes>` |

### States

<!-- Loading, empty, error, disabled, permission-denied, optimistic/pending, etc. -->

### Frontend Test Matrix

| Scenario ID / Flow | Test Level | Tool / Command | Viewport | Console / Network | Evidence | Gap |
|---|---|---|---|---|---|---|
| `<flow/state>` | `<unit/component/e2e/visual smoke/manual>` | `<npm test... / playwright... / gstack-qa-only / existing tool>` | `<desktop/mobile/tablet/N/A>` | `<checked/not applicable>` | `<test file/log/screenshot>` | `<none or MISSING blocked: reason>` |

---

## Task 1: <!-- Component Name -->

- [ ] **Step 1:** <!-- micro-step -->
- [ ] **Step 2:** <!-- micro-step -->
