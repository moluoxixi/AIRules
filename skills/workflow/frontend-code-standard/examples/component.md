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

## 复杂组件

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
    composables/
      index.ts
      use-data-table.ts
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

## React 复杂组件

```text
DataTableReact/
  README.md
  index.ts
  src/
    index.tsx
    hooks/
      index.ts
      use-data-table.ts
    types/
      props.ts
      ref.ts
      index.ts
    utils/
      index.ts
      normalize-column.ts
```
