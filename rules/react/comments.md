# React Comments

Documentation conventions for React / Next.js projects.

## Component Documentation

Document component purpose, props, and behavior:

```tsx
/**
 * Displays a paginated list of user cards with search filtering.
 * Automatically fetches data on mount and when filters change.
 *
 * @example
 * <UserList
 *   pageSize={20}
 *   onUserSelect={(user) => router.push(`/users/${user.id}`)}
 * />
 */
export function UserList({ pageSize, onUserSelect }: UserListProps) {
```

## Props Interface Documentation

```tsx
interface UserListProps {
  /** Number of items to display per page (default: 10) */
  pageSize?: number;

  /** Callback when user clicks a card */
  onUserSelect?: (user: User) => void;

  /** Initial search query for filtering */
  initialQuery?: string;
}
```

## Hooks Documentation

```tsx
/**
 * Manages pagination state with URL synchronization.
 * Updates browser history when page changes.
 *
 * @param totalItems - Total count for calculating max page
 * @param itemsPerPage - Items displayed per page
 * @returns Current page, total pages, and page change handler
 *
 * @example
 * const { page, totalPages, setPage } = usePagination(100, 20);
 */
export function usePagination(totalItems: number, itemsPerPage: number) {
```

## Server Component Documentation

```tsx
/**
 * Server Component that fetches product details.
 * Renders static HTML on build for public products.
 *
 * @param params - Route parameters containing product slug
 */
export default async function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = await getProduct(params.slug);
  // ...
}
```

## Client Component Marker

```tsx
'use client';

/**
 * Interactive search input with debounced onChange.
 * Client Component - requires JavaScript.
 */
export function SearchInput({ onSearch }: SearchInputProps) {
```
