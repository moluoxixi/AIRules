---
name: ui-test-planning
description: Use when planning or reviewing UI test coverage for web pages or apps, including Playwright flows, smoke tests, page objects, selectors, accessibility checks, and critical user journeys.
---

# UI Test Planning

## Focus

- Test user-visible behavior, not implementation details
- Start from the highest-value user journeys
- Keep selectors stable and intention-revealing
- Capture loading, empty, error, and success states

## Workflow

1. List the critical user flows.
2. Mark which flows need smoke coverage and which need deep coverage.
3. Prefer resilient selectors tied to labels, roles, or stable test ids.
4. Add accessibility smoke checks for key pages where possible.

## Review Checklist

- Does each test represent a user goal?
- Are selectors robust against layout churn?
- Are failure screenshots, logs, or traces easy to inspect?
- Are login, navigation, and submission paths covered?

## Related Rules

- `rules/common/testing-standards.md` - Cross-language testing principles
- `rules/frontend/testing.md` - Frontend-specific testing patterns

## Verification Requirements

- All critical user journeys have test coverage
- Selectors use roles/labels over CSS classes
- Accessibility checks pass where applicable
- Test reports are accessible and actionable
