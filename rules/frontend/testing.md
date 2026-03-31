# Frontend Testing

Cross-framework testing principles for frontend projects.

## Test Pyramid

1. **Unit tests** - Functions, hooks, utilities (fast, isolated)
2. **Component tests** - Single component behavior (DOM interactions)
3. **Integration tests** - Multiple components working together
4. **E2E tests** - Critical user paths only

## Component Testing Principles

Test user-visible behavior, not implementation:

```typescript
// Good: Tests what user sees
it('should display error message when submit fails', async () => {
  render(<LoginForm />);
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  expect(screen.getByText(/invalid credentials/i)).toBeVisible();
});

// Avoid: Tests implementation details
it('should set error state to true', () => {
  const wrapper = shallow(<LoginForm />);
  wrapper.instance().handleSubmit();
  expect(wrapper.state('error')).toBe(true);
});
```

## DOM Testing Priorities

Query elements by priority:

1. `getByRole` - Buttons, inputs, headings
2. `getByLabelText` - Form elements
3. `getByText` - Visible text content
4. `getByTestId` - Last resort for dynamic content

## Visual Regression

Use for stable UI components:

```typescript
// Storybook + Chromatic or Loki
export const Primary = {
  render: () => <Button variant="primary">Click me</Button>,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};
```

## Accessibility Testing

```typescript
import { axe } from 'jest-axe';

it('should have no accessibility violations', async () => {
  const { container } = render(<Modal />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Snapshot Testing

Limit to stable contracts:

```typescript
// Good: API response contracts
expect(apiResponse).toMatchSnapshot();

// Avoid: Component renders that change frequently
expect(wrapper.html()).toMatchSnapshot();
```

## Test Data

```typescript
// Use factories for consistent test data
const createUser = (overrides?: Partial<User>): User => ({
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  ...overrides,
});
```

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

### Verification Requirements

- All critical user journeys have test coverage
- Selectors use roles/labels over CSS classes
- Accessibility checks pass where applicable
- Test reports are accessible and actionable
- MCP browser verification executed when applicable (optional)
