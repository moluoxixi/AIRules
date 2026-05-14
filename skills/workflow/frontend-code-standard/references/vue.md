# Vue 规范

## SFC 顺序

```vue
<template>
<script setup lang="ts">
<style scoped>
```

如果项目工具强制其他顺序，优先遵循项目工具。

## 组件目录

```text
FormDrawer/
  index.vue
DetailDrawer/
  index.vue
ConfirmDialog/
  index.vue
```

## Composable 边界

Composable 适合承载视图消费的状态、派生状态、数据加载、校验编排和动作。

```ts
/**
 * 管理用户列表页的查询、分页和加载状态。
 *
 * 不处理弹窗显隐和路由跳转；接口异常保持抛出，交由页面统一错误处理。
 */
export function useUserList() {}
```

视图文件调用 composable，并绑定其返回状态：

```vue
<script setup lang="ts">
import { useUserList } from './composables/useUserList'

const { tableData, loading, handleSearch } = useUserList()
</script>
```

## 事件与 refs

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

除非逻辑非常简单且只服务于当前渲染，否则不要把数据加载、权限规则或表单规范化直接放在 `<script setup>` 中。
