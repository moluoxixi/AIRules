# Vue Comments

Documentation conventions for Vue 3 / Vite projects.

## SFC Component Documentation

Document component purpose in `<script setup>`:

```vue
<script setup lang="ts">
/**
 * Displays a paginated user list with search and filter capabilities.
 * Emits events when users are selected or actions performed.
 */

interface Props {
  /** Initial search query for user filtering */
  initialQuery?: string;

  /** Number of users per page (default: 10) */
  pageSize?: number;
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 10,
});
</script>
```

## Composable Documentation

```typescript
/**
 * Manages form validation state with async server checks.
 *
 * @param rules - Validation rules object
 * @param options - Configuration for debounce and server validation
 * @returns Validation state, errors, and validate function
 *
 * @example
 * const { errors, validate, isValid } = useFormValidation(rules, {
 *   debounceMs: 300,
 *   serverValidate: checkEmailUnique
 * });
 */
export function useFormValidation(
  rules: ValidationRules,
  options: ValidationOptions = {}
) {
```

## Template Comments

Use HTML comments for complex template logic:

```vue
<template>
  <div class="user-list">
    <!-- Loading state: show skeleton while fetching -->
    <SkeletonLoader v-if="loading" :count="pageSize" />

    <!-- Empty state: no users match filters -->
    <EmptyState v-else-if="users.length === 0" />

    <!-- User cards grid -->
    <div v-else class="grid">
      <UserCard
        v-for="user in users"
        :key="user.id"
        :user="user"
        @select="handleSelect"
      />
    </div>
  </div>
</template>
```

## Style Comments

```vue
<style scoped>
/* Grid layout for user cards - responsive 1-4 columns */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

/* Highlight selected user - used with v-bind class */
.selected {
  border-color: var(--primary-color);
}
</style>
```

## Emits Documentation

```typescript
const emit = defineEmits<{
  /** Fired when user clicks a card */
  (e: 'select', user: User): void;

  /** Fired when page changes, includes new page number */
  (e: 'pageChange', page: number): void;
}>();
```
