---
name: react-patterns
description: "Use when building or refactoring React applications, including components, hooks, Server Components, and state management"
---

# React Patterns

## Overview

Best practices for React 18+ and Next.js applications: component patterns, hooks, Server Components, and state management.

## When to Use

- Building new React components
- Refactoring existing React code
- Choosing between Client and Server Components
- Implementing state management

## Core Patterns

### Component Types

**Server Components (default in Next.js App Router):**
- Fetch data directly in component
- Access backend resources securely
- Reduce client-side JavaScript

**Client Components (`'use client'`):**
- Use for interactivity (onClick, useState, useEffect)
- Browser APIs (localStorage, geolocation)
- Custom hooks with side effects

### Hooks Best Practices

```typescript
// Custom hooks for reusable logic
function useUser(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  // Fetch logic here
  return user;
}

// Keep hooks focused and composable
function useForm<T>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const handleChange = (key: keyof T, value: unknown) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };
  return { values, handleChange };
}
```

### State Management

- **Local state**: useState for component-only state
- **Lift state**: When siblings need to share
- **Context**: For truly global state (theme, auth)
- **External libraries**: Zustand/Jotai for complex global state

### Component Structure

```typescript
// Props interface first
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
  onClick?: () => void;
}

// Component with explicit return type
export function Button({ variant = 'primary', children, onClick }: ButtonProps) {
  return <button className={variant} onClick={onClick}>{children}</button>;
}
```

## Review Checklist

- Is this a Server Component or Client Component? Correct choice?
- Can this logic be extracted to a custom hook?
- Is state in the right place (local, lifted, or global)?
- Are props interfaces explicit and documented?
- Are effects properly cleaned up?

## Related Rules

- `rules/react/overview.md` - React architecture principles
- `rules/react/comments.md` - Component and hook documentation
- `rules/react/testing.md` - Vitest/Jest + Testing Library
- `rules/react/verification.md` - ESLint + typescript-eslint + Prettier
- `rules/frontend/jsdoc.md` - JSDoc for exported components

## Verification Requirements

- ESLint passes with react-hooks rules
- TypeScript strict mode passes
- Component tests cover user interactions
- No unused imports or variables
