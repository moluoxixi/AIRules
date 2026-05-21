# Vue 组件示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 简单组件

```text
components/
  StatusBadge.vue
  UserAvatar.vue
  InlineChart.vue
  LoadingSpinner.vue
```

简单组件优先保持单文件。只有出现复用逻辑、复杂契约或独立包级 API 时，才升级为复杂组件包。

## 复杂组件包

```text
DataTable/
  README.md
  index.ts
  src/
    index.vue
    composables/
      index.ts
      use-table-sort.ts
      use-table-filter.ts
    components/
      index.ts
      HeaderCell.vue
      BodyRow.vue
      EmptyState.vue
      Pagination.vue
    types/
      props.ts
      emit.ts
      expose.ts
      slots.ts
      index.ts
    utils/
      index.ts
      normalize-column.ts
    styles/
      index.scss
      data-table.scss
```

## script setup 示例

```vue
<script setup lang="ts">
import type { DataTableColumn } from './types'

// props 契约
const props = withDefaults(defineProps<{
  columns: DataTableColumn[]
  data: unknown[]
  loading?: boolean
  emptyText?: string
}>(), {
  loading: false,
  emptyText: '暂无数据',
})

// emits 契约
const emit = defineEmits<{
  rowClick: [row: unknown, index: number]
  sort: [column: string, order: 'asc' | 'desc']
}>()

// v-model（Vue 3.4+）
const selectedRows = defineModel<unknown[]>('selected', { default: () => [] })

// expose 契约
defineExpose({
  refresh: () => { /* ... */ },
  scrollToRow: (index: number) => { /* ... */ },
})

// 模板 ref（Vue 3.5+）
const tableRef = useTemplateRef<HTMLTableElement>('table')

// 派生状态用 computed
const isEmpty = computed(() => props.data.length === 0 && !props.loading)
</script>
```

## slots 类型示例

```vue
<script setup lang="ts">
defineSlots<{
  default: (props: { item: unknown; index: number }) => any
  header: () => any
  empty: () => any
  loading: () => any
}>()
</script>
```

## provide/inject 示例

```ts
// types/injection-keys.ts
import type { InjectionKey, Ref } from 'vue'

export interface TableContext {
  selectedRows: Ref<unknown[]>
  toggleRow: (row: unknown) => void
}

export const TABLE_CONTEXT_KEY: InjectionKey<TableContext> = Symbol('TableContext')

// 父组件 provide
provide(TABLE_CONTEXT_KEY, {
  selectedRows,
  toggleRow,
})

// 子组件 inject（带默认值或显式错误）
const context = inject(TABLE_CONTEXT_KEY)
if (!context) {
  throw new Error('BodyRow must be used within DataTable')
}
```

## 公共入口示例

```ts
// DataTable/index.ts
export { default as DataTable } from './src/index.vue'
export type * from './src/types'
```

公共 props 表达调用契约；内部排序、筛选和格式化逻辑不要从包外 deep import。
