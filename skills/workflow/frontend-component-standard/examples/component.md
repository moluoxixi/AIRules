# 组件示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 简单组件

```text
components/
  StatusBadge.vue
  InlineChart.tsx
  Sparkline.jsx
  UserAvatar.vue
```

简单组件优先保持单文件。只有出现复用逻辑、复杂契约或独立包级 API 时，才升级为复杂组件包。

## Vue 复杂组件包

```text
DataTable/
  README.md
  index.ts
  src/
    index.vue
    api/
      index.ts
      data-table-api.ts
    components/
      index.ts
      HeaderCell.vue
      EmptyState.vue
    types/
      props.ts
      emit.ts
      expose.ts
      index.ts
    utils/
      index.ts
      normalize-column.ts
    styles/
      index.scss
      data-table.scss
```

## React 复杂组件包

```text
DataTableReact/
  README.md
  index.ts
  src/
    index.tsx
    types/
      props.ts
      ref.ts
      index.ts
    utils/
      index.ts
      normalize-column.ts
```

## 实现片段

```ts
export interface DataTableProps<Row> {
  rows: Row[]
  rowKey: (row: Row) => string
  loading?: boolean
  emptyText?: string
}
```

公共 props 表达调用契约；内部排序、筛选和格式化逻辑不要从包外 deep import。
