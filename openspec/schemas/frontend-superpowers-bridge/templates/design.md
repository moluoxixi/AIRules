## Context

<!--
Background, current state, constraints, stakeholders.
brainstorm.md 記錄了探索過程（替代方案 + 選定方向）；
本檔承接選定方向，展開完整技術設計。
-->

## Goals / Non-Goals

**Goals:**
<!-- What this design aims to achieve -->

**Non-Goals:**
<!-- What is explicitly out of scope -->

## Decisions

<!--
所有技術決策的唯一來源（single source of truth）。
brainstorm.md 的 Agreed Approach 記錄了「選了哪條路」，
本段記錄「那條路上的每個岔口怎麼選的」。

每個決策建議結構：
### D1：<決策標題>
- **選擇**：<採用的做法>
- **理由**：<為何這樣選>
- **已考慮 alternative**：<被拒方案 + 拒絕原因>
-->

## Risks / Trade-offs

<!--
Known risks and trade-offs.
Format: [Risk] <描述> → Mitigation: <緩解措施>
[Trade-off] <取捨描述> → 接受理由
-->

## Migration Plan

<!--
部署順序、rollback 策略、驗收條件。
若本 change 不涉及部署變更（純加套件、無 endpoint / DB 變更），
可寫「N/A — 本 change 不涉及部署變更」。
-->

## Open Questions

<!-- Outstanding decisions or unknowns to resolve -->

## Layout

<!--
Page/route layout and interaction preview.

Required:
- Entry route(s), exit/navigation path(s), refresh/deep-link behavior.
- Desktop/mobile layout; add tablet if the page is dense or multi-panel.
- Interaction flow for submit/cancel/retry/filter/sort/pagination where applicable.
- Permission-denied and unavailable-state placement.
-->

| Region | Purpose | Entry/Exit | Interaction Flow | Responsive Notes |
|---|---|---|---|---|
| — | — | — | — | — |

## Fields

<!--
Every UI-visible or UI-required field MUST map to a source contract.

Source Type enum:
API / OpenAPI / interface code / API client / store / route params /
permission / state / persistence / static / derived

Missing Status:
- OK
- MISSING blocked: <reason>

If any UI-required field is absent, ambiguous, or permission-unverifiable,
mark MISSING blocked and do not continue to implementation planning.
Do not invent mock fields, default values, empty fallbacks, or "fill later".
-->

| Area | Field Name | UI Purpose | Source Type | Source Path / Endpoint | Exists? | Missing Status | Component Decision | Component Path | Display Shape | Permission Control | State Coverage | Test Point |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| — | — | — | API / OpenAPI / interface code / API client / store / route params / permission / state / persistence / static / derived | — | yes/no | OK / MISSING blocked: <reason> | existing / wrap existing / new | — | input/select/button/table/text/badge/etc. | — | loading/empty/error/disabled/success/permission-denied/pending/N/A | — |

## Components

<!--
Search existing project components, hooks/composables, utilities, and UI libraries first.
Every UI unit MUST be classified as existing / wrap existing / new.
Wrap/new decisions require reason, input/output contract, dependent fields,
states, accessibility notes, and reuse scope.
-->

| UI Unit | Decision | Reuse Path / New Path | Reason | Inputs | Outputs / Events | Covered States | Accessibility Notes | Reuse Scope |
|---|---|---|---|---|---|---|---|---|
| — | existing / wrap existing / new | — | — | — | — | — | — | — |

## States

| State | Required? | UI Behavior | Source / Trigger | Component Handling | Test Evidence |
|---|---|---|---|---|---|
| loading | yes/no/N/A | — | — | — | — |
| empty | yes/no/N/A | — | — | — | — |
| error | yes/no/N/A | — | — | — | — |
| disabled | yes/no/N/A | — | — | — | — |
| success | yes/no/N/A | — | — | — | — |
| permission-denied | yes/no/N/A | — | — | — | — |
| pending | yes/no/N/A | — | — | — | — |

## Frontend Test Matrix

<!--
Use project-existing test tools first. Missing tool support must be marked
MISSING blocked or NOT RUN automated with reason; do not infer PASS.
-->

| Dimension | Required Check | Tool / Command | Evidence Target | Status |
|---|---|---|---|---|
| Page / Route | entry, exit, navigation, refresh, deep link, permission redirect | — | — | TODO / N/A / MISSING blocked |
| Fields | source, display shape, formatting, empty value, API presence | — | — | TODO / N/A / MISSING blocked |
| Components | existing/wrapped/new components and state coverage | — | — | TODO / N/A / MISSING blocked |
| State | loading, empty, error, disabled, success, permission-denied, pending | — | — | TODO / N/A / MISSING blocked |
| Interaction | click, input, submit, cancel, retry, pagination, filter, sort | — | — | TODO / N/A / MISSING blocked |
| Responsive | desktop and mobile viewport; tablet for dense pages | — | — | TODO / N/A / MISSING blocked |
| Observable Errors | console error, network error, request status, exception message | — | — | TODO / N/A / MISSING blocked |
| Regression Evidence | unit, component, integration, E2E/browser, screenshot/log | — | — | TODO / N/A / MISSING blocked |
