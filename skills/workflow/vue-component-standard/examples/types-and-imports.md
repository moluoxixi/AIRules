# 类型与导入示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 类型出口

```ts
// types/index.ts
export type * from './props'
export type * from './emit'
export type * from './expose'
export type * from './slots'
```

## props 类型

```ts
// types/props.ts
export interface DataTableColumn<Row = unknown> {
  key: keyof Row | string
  title: string
  width?: number | string
  sortable?: boolean
  render?: (value: unknown, row: Row, index: number) => VNode | string
}

export interface DataTableProps<Row = unknown> {
  columns: DataTableColumn<Row>[]
  data: Row[]
  rowKey: keyof Row | ((row: Row) => string)
  loading?: boolean
  emptyText?: string
}
```

## emit 类型

```ts
// types/emit.ts
export interface DataTableEmits<Row = unknown> {
  rowClick: [row: Row, index: number]
  rowDblclick: [row: Row, index: number]
  sort: [column: string, order: 'asc' | 'desc' | null]
  selectionChange: [rows: Row[]]
}
```

## expose 类型

```ts
// types/expose.ts
export interface DataTableExpose {
  refresh: () => Promise<void>
  scrollToRow: (index: number) => void
  clearSelection: () => void
  getSelectedRows: () => unknown[]
}
```

## slots 类型

```ts
// types/slots.ts
export interface DataTableSlots<Row = unknown> {
  default: (props: { row: Row; index: number }) => any
  header: (props: { column: DataTableColumn<Row> }) => any
  empty: () => any
  loading: () => any
  footer: () => any
}
```

## 导入边界

禁止导入：

```ts
// 穿透 src/ 目录
import { formatDate } from '@/components/DataTable/src/utils/date'

// 穿透到具体实现文件
import { useTableSort } from '@/components/DataTable/src/composables/use-table-sort'

// 相对路径穿透
import { formatDate } from '../../utils/date'
import type { DataTableColumn } from '../../../components/DataTable/src/types/props'
```

允许导入：

```ts
// 通过公开入口导入组件和类型
import { DataTable } from '@/components/DataTable'
import type { DataTableProps, DataTableColumn, DataTableExpose } from '@/components/DataTable'

// 使用路径别名
import { DataTable, type DataTableProps } from '@/components/DataTable'
```

## 组件内部导入

```vue
<script setup lang="ts">
// 组件内部可以使用相对路径
import type { DataTableProps, DataTableEmits } from './types'
import { useTableSort } from './composables/use-table-sort'
import HeaderCell from './components/HeaderCell.vue'
</script>
```
