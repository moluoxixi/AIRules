# Vue Comments

Documentation conventions for Vue 3 / Vite projects.

> **注释语言**：注释语言跟随项目所在地区，详见 [common/comments.md](../common/comments.md)。代码示例使用中文注释。

## SFC Component Documentation

Document component purpose in `<script setup>`:

```vue
<script setup lang="ts">
/**
 * 展示带搜索和筛选功能的分页用户列表
 * 当用户被选中或执行操作时触发事件
 */

interface Props {
  /** 用户筛选的初始搜索关键词 */
  initialQuery?: string;

  /** 每页用户数量（默认：10） */
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
 * 管理表单验证状态，支持异步服务端校验
 *
 * @param rules - 验证规则对象
 * @param options - 防抖和服务器验证的配置
 * @returns 验证状态、错误信息和验证函数
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
    <!-- 加载状态：数据获取中显示骨架屏 -->
    <SkeletonLoader v-if="loading" :count="pageSize" />

    <!-- 空状态：没有匹配筛选条件的用户 -->
    <EmptyState v-else-if="users.length === 0" />

    <!-- 用户卡片网格 -->
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
/* 用户卡片网格布局 - 响应式 1-4 列 */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

/* 高亮选中用户 - 与 v-bind class 配合使用 */
.selected {
  border-color: var(--primary-color);
}
</style>
```

## Emits Documentation

```typescript
const emit = defineEmits<{
  /** 用户点击卡片时触发 */
  (e: 'select', user: User): void;

  /** 页码变化时触发，包含新的页码 */
  (e: 'pageChange', page: number): void;
}>();
```
