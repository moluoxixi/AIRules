# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

## Summary

[Extract from feature spec: primary requirement + technical approach]

## Technical Context

**Language/Version**: [e.g., TypeScript 5.x or NEEDS CLARIFICATION]

**Primary Dependencies**: [e.g., React, Vue, Vite, Next.js, component library]

**State/Data Sources**: [API client, store, route params, persistence, static config]

**Testing**: [unit/component/integration/E2E/browser/visual tools or MISSING blocked]

**Target Platform**: [browser/runtime support]

**Project Type**: [frontend app, frontend package, full-stack with frontend scope]

**Performance/UX Goals**: [interaction latency, responsive targets, accessibility targets]

## Constitution Check

[Gates determined based on `.specify/memory/constitution.md`]

## Frontend Gate *(must pass before tasks)*

### Layout

[Page regions, responsive behavior, navigation, and interaction flow.]

### Fields

| Area | Field | UI Purpose | Source Type | Source Path / Endpoint | Exists? | Missing Status | Component Decision | Test Point |
|------|-------|------------|-------------|------------------------|---------|----------------|--------------------|------------|
| [page/region] | [field] | [why shown] | [API/OpenAPI/interface code/API client/store/route params/permission/state/persistence/static/derived] | [path] | [yes/no/unclear] | [OK or MISSING blocked: reason] | [existing/wrap existing/new] | [test] |

Any `MISSING blocked:` row blocks task generation and bridge execution.

### Components

| UI Unit | Decision | Path | Reason | Accessibility Notes | Reuse Scope |
|---------|----------|------|--------|---------------------|-------------|
| [component] | [existing/wrap existing/new] | [path or N/A] | [why] | [notes] | [scope] |

### States

| UI Unit | Loading | Empty | Error | Disabled | Success | Permission Denied | Pending | N/A Reason |
|---------|---------|-------|-------|----------|---------|-------------------|---------|------------|
| [component] | [decision] | [decision] | [decision] | [decision] | [decision] | [decision] | [decision] | [reason] |

### Frontend Test Matrix

| Behavior / Field / State | Unit | Component | Integration | E2E / Browser | Visual / Responsive | Evidence Required |
|--------------------------|------|-----------|-------------|---------------|---------------------|-------------------|
| [item] | [yes/N/A] | [yes/N/A] | [yes/N/A] | [yes/N/A] | [yes/N/A] | [command, viewport, screenshot/log] |

Follow the `frontend-testing` discipline. Missing automated tooling is `MISSING blocked: no frontend test runner` or `NOT RUN automated: <reason>`, never PASS.

## Project Structure

```text
[real frontend/backend package layout for this feature]
```

**Structure Decision**: [Document selected structure and reference real directories]

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [if any] | [reason] | [alternative] |
