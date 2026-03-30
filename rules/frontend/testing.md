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
