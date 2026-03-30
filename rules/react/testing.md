# React Testing

Testing standards for React / Next.js projects.

## Test Framework Stack

- **Vitest** (preferred) or **Jest**: Test runner
- **React Testing Library**: Component testing utilities
- **@testing-library/user-event**: User interaction simulation
- **Playwright**: E2E testing

## Component Testing

Prioritize user-visible behavior over implementation details:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserCard } from './UserCard';

describe('UserCard', () => {
  it('should display user name and email', () => {
    render(<UserCard name="John Doe" email="john@example.com" />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('should call onEdit when edit button clicked', async () => {
    const onEdit = vi.fn();
    render(<UserCard name="John" email="john@example.com" onEdit={onEdit} />);

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
```

## Hooks Testing

```tsx
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('should increment count', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });
});
```

## Async Component Testing

```tsx
it('should display users after loading', async () => {
  render(<UserList />);

  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
```

## E2E Testing with Playwright

```typescript
import { test, expect } from '@playwright/test';

test('user can complete checkout flow', async ({ page }) => {
  await page.goto('/products');
  await page.click('[data-testid="product-1"]');
  await page.click('[data-testid="add-to-cart"]');
  await page.click('[data-testid="checkout"]');

  await expect(page).toHaveURL('/checkout');
});
```

## Testing Priorities

1. Critical user paths (login, checkout, core workflows)
2. Complex component interactions
3. Edge cases (empty states, errors, loading)
4. Accessibility (keyboard navigation, screen readers)
