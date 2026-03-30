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

## MCP Execution

When UI changes are detected and MCP tools (playwright, browser) are available, execute automated browser verification.

### MCP Tool Detection

Identify available UI testing MCPs in the environment:
- `playwright` - Full browser automation and testing
- `browser` - Browser interaction and navigation tools
- `puppeteer` - Chrome DevTools Protocol based automation
- `selenium` - Cross-browser testing framework

### Inquiry Mechanism

After Verify phase passes, ask user in natural language:

> "All verification checks passed. Detected Playwright MCP is available in the current environment. Would you like to launch browser verification for the page effects?"

**Response Handling:**
- Positive responses ("yes", "sure", "verify it", "go ahead") → Execute MCP verification
- No response or topic change → Skip to Review phase
- Never use popups, selection boxes, or blocking prompts

### MCP Execution Flow

1. **Launch Browser & Navigate**
   - Start browser instance via MCP
   - Navigate to target page URL
   - Wait for page load completion

2. **Screenshot Validation**
   - Capture full-page screenshot
   - Capture viewport screenshot
   - Compare against baseline if available
   - Flag visual regressions

3. **Critical Interaction Testing**
   - Execute key user flows (click, hover, scroll)
   - Form input and submission validation
   - Navigation between pages
   - Modal/dialog interactions

4. **Console Log Inspection**
   - Capture browser console output
   - Check for errors, warnings, or exceptions
   - Flag unexpected log messages

5. **Network Request Verification**
   - Monitor XHR/fetch requests
   - Verify API response status codes
   - Check response data structure

6. **Evidence Collection**
   - Save screenshots with timestamps
   - Export console logs
   - Document network activity
   - Generate structured report

### Result Reporting

Present verification results in structured format:

```
MCP UI Verification Report
===========================
Status: [Passed / Failed / Skipped]

Screenshots:
- [full-page] ✓ No visual regressions
- [viewport] ✓ Layout renders correctly

Interactions:
- [login flow] ✓ 3 steps completed
- [form submission] ✓ Success state reached

Console Logs:
- Errors: 0
- Warnings: 1 (non-critical)

Network:
- API calls: 5 (all 200 OK)
- Failed requests: 0
```

## Verification Requirements

- All critical user journeys have test coverage
- Selectors use roles/labels over CSS classes
- Accessibility checks pass where applicable
- Test reports are accessible and actionable
- MCP browser verification executed when applicable (optional)
