# Vue Testing

Testing standards for Vue 3 / Vite projects.

## Test Framework Stack

- **Vitest**: Test runner (preferred for Vite projects)
- **@vue/test-utils**: Vue component testing utilities
- **@testing-library/vue**: Alternative DOM-focused testing
- **Playwright**: E2E testing

## Component Testing

```typescript
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import UserCard from './UserCard.vue';

describe('UserCard', () => {
  it('should display user information', () => {
    const wrapper = mount(UserCard, {
      props: {
        user: {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
        },
      },
    });

    expect(wrapper.text()).toContain('John Doe');
    expect(wrapper.text()).toContain('john@example.com');
  });

  it('should emit select event when clicked', async () => {
    const wrapper = mount(UserCard, {
      props: { user: { id: '1', name: 'John' } },
    });

    await wrapper.find('button').trigger('click');

    expect(wrapper.emitted('select')).toBeTruthy();
    expect(wrapper.emitted('select')[0]).toEqual([{ id: '1', name: 'John' }]);
  });
});
```

## Composable Testing

```typescript
import { describe, it, expect } from 'vitest';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('should increment count', () => {
    const { count, increment } = useCounter();

    increment();

    expect(count.value).toBe(1);
  });

  it('should respect initial value', () => {
    const { count } = useCounter(10);

    expect(count.value).toBe(10);
  });
});
```

## Async Component Testing

```typescript
it('should load and display users', async () => {
  const wrapper = mount(UserList);

  expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true);

  await flushPromises();

  expect(wrapper.findAll('[data-testid="user-card"]').length).toBeGreaterThan(0);
});
```

## Store Testing (Pinia)

```typescript
import { setActivePinia, createPinia } from 'pinia';
import { useUserStore } from './userStore';

describe('User Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should add user to list', () => {
    const store = useUserStore();

    store.addUser({ id: '1', name: 'John' });

    expect(store.users).toHaveLength(1);
  });
});
```

## Testing Priorities

1. Component props/emits contract
2. Composable logic and reactivity
3. Store state mutations and actions
4. Form validation and submission
5. Critical user interactions
