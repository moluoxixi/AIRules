# React Rules Overview

Applicable to React / Next.js projects.

## Architecture Principles

- Components split by responsibility
- Prioritize clear data flow and state boundaries
- Maintain separation of client and server responsibilities
- Page orchestration combines external skills like `frontend-design` and `cache-components`

## Related Rules

- [comments.md](./comments.md) - Components, hooks, Server Component comment standards
- [testing.md](./testing.md) - Vitest/Jest + Testing Library testing standards
- [verification.md](./verification.md) - ESLint + typescript-eslint + Prettier verification
- [frontend/workflow.md](../frontend/workflow.md) - Page task standard workflow

## Component Directory Structure

```
ComponentName/
├── index.ts                    # Entry file, exports component and types
├── README.md                   # Component docs (keep if exists)
└── src/
    ├── index.tsx               # Main component file
    ├── types/                  # TypeScript type definitions
    │   ├── index.ts            # Unified type exports
    │   ├── props.ts            # Props types
    │   └── types.ts            # Other types
    ├── components/             # Sub-components (if needed)
    ├── hooks/                  # Custom hooks (if needed)
    └── constants/              # Constants (if needed)
```

Rules:
1. Split type files by responsibility: `props.ts`, `types.ts`
2. Only create directories that are actually needed
3. `index.ts` entry exports component and all types

## Page Directory Structure

```
PageName/
├── types/                      # TypeScript type definitions
│   ├── index.ts                # Unified type exports
│   ├── props.ts                # Props types (if needed)
│   └── types.ts                # Other types (API responses, form fields, etc.)
├── components/                 # Page-specific components (if needed)
├── hooks/                      # Custom hooks (if needed)
├── constants/                  # Constants (if needed)
└── index.tsx                   # Main page file
```

Rules:
1. Page-specific components go in local `components/`, not global `components/`
2. Only create directories that are actually needed
3. Complex pages may subdivide by functional modules
4. Page directories do **not** use a `src/` wrapper — subdirectories and the main file sit directly under the page directory

## Component Types

**Server Components (default in Next.js App Router):**
- Fetch data directly in component
- Access backend resources securely
- Reduce client-side JavaScript

**Client Components (`'use client'`):**
- Use for interactivity (onClick, useState, useEffect)
- Browser APIs (localStorage, geolocation)
- Custom hooks with side effects

## Hooks Best Practices

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

## State Management

- **Local state**: useState for component-only state
- **Lift state**: When siblings need to share
- **Context**: For truly global state (theme, auth)
- **External libraries**: Zustand/Jotai for complex global state

## Component Structure

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
