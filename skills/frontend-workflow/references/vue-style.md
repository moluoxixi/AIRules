# Vue 代码风格

## SFC 标签顺序

```
<template>
<script setup lang="ts">
<style scoped>
```

## 组件目录 — PascalCase，入口 `index`

```
FormDrawer/
├── index.vue
DetailDrawer/
├── index.vue
ConfirmDialog/
├── index.vue
```

## 组件 ref — 小驼峰 + Ref 后缀

```vue
<script setup lang="ts">
const formDrawerRef = ref<InstanceType<typeof FormDrawer>>()
const detailDrawerRef = ref<InstanceType<typeof DetailDrawer>>()
</script>
```

## Composable — `use` + 大驼峰

```vue
<script setup lang="ts">
import { useUserList } from '../composables'
import { useOrderDetail } from '../composables'
</script>
```



## 事件处理函数 — handle + 大驼峰描述

```vue
<script setup lang="ts">
function handleSearch() { }
function handleSelectionChange() { }
function handleAudit() { }
</script>
```
