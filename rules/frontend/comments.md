# Frontend Comments

Cross-framework documentation conventions for frontend projects.

## Core Principles

- Document **why** and **constraints**, not obvious behavior
- Focus on business semantics, side effects, and edge cases
- Don't repeat type information already in TypeScript

## JSDoc/TSDoc Basics

```typescript
/**
 * Calculates discounted price with tiered rates.
 *
 * @param basePrice - Original price before discounts
 * @param quantity - Number of items for volume discount calculation
 * @returns Final price after all applicable discounts
 * @throws Error if basePrice is negative
 */
function calculatePrice(basePrice: number, quantity: number): number {
```

## Component Comments

Document component purpose and important props:

```typescript
/**
 * Renders a data table with sorting, filtering, and pagination.
 *
 * Performance note: Uses virtualization for lists > 1000 items.
 */
interface DataTableProps<T> {
  /** Data rows to display */
  data: T[];

  /** Column definitions with renderers */
  columns: ColumnDef<T>[];

  /** Called when row selection changes */
  onSelectionChange?: (selected: T[]) => void;
}
```

## Style Comments

```css
/* Component: Card
   Used for product listings and user profiles.
   Supports hover states and loading skeletons. */
.card {
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

/* Modifier: Card highlighted state
   Applied when item is selected or featured */
.card--highlighted {
  border-color: var(--color-primary);
}
```

## Complex Logic Comments

```typescript
// Debounce search input to avoid excessive API calls.
// 300ms delay balances responsiveness with server load.
const debouncedSearch = useDebounce(searchQuery, 300);

// NOTE: This workaround handles Safari's flexbox bug with overflow.
// Can be removed when Safari 15 support is dropped.
const safariFix = { minHeight: 0 };
```

## File Header Comments

```typescript
/**
 * @file User authentication utilities
 * @description Handles JWT token management, session persistence,
 *   and automatic token refresh before expiration.
 */
```

## Avoid

- Comments that repeat variable names
- Outdated comments; update or delete
- Commenting every line of obvious code
