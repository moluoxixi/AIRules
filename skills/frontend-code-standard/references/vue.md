# Vue Standard

## SFC Order

```vue
<template>
<script setup lang="ts">
<style scoped>
```

Follow project tooling if it enforces a different order.

## Component Directory

```text
FormDrawer/
  index.vue
DetailDrawer/
  index.vue
ConfirmDialog/
  index.vue
```

## Composable Boundary

Composables should contain state, derived state, data fetching, validation orchestration, and actions that the view consumes.

```ts
/**
 * 管理用户列表页的查询、分页和加载状态。
 *
 * 不处理弹窗显隐和路由跳转；接口异常保持抛出，交由页面统一错误处理。
 */
export function useUserList() {}
```

Views should call composables and bind returned state:

```vue
<script setup lang="ts">
import { useUserList } from './composables/useUserList'

const { tableData, loading, handleSearch } = useUserList()
</script>
```

## Events And Refs

```vue
<script setup lang="ts">
const formDrawerRef = ref<InstanceType<typeof FormDrawer>>()

/**
 * 响应查询表单提交。
 *
 * 仅重置分页并触发列表查询，不直接改写筛选字段。
 */
function handleSearch() {}
</script>
```

Do not put data fetching, permission rules, or form normalization directly in `<script setup>` unless the logic is trivial and purely local to rendering.
