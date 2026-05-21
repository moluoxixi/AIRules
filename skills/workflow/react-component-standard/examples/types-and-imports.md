# 类型与导入示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 类型出口

```ts
// types/index.ts
export type * from './props'
export type * from './ref'
export type * from './context'
```

## props 类型

```ts
// types/props.ts
export interface DataTableColumn<Row = unknown> {
  key: keyof Row | string
  title: string
  width?: number | string
  sortable?: boolean
  render?: (value: unknown, row: Row, index: number) => React.ReactNode
}

export interface DataTableProps<Row = unknown> {
  columns: DataTableColumn<Row>[]
  data: Row[]
  rowKey: keyof Row | ((row: Row) => string)
  loading?: boolean
  emptyText?: string
  selected?: Row[]
  onSelectedChange?: (rows: Row[]) => void
  onRowClick?: (row: Row, index: number) => void
  onSort?: (column: string, order: 'asc' | 'desc' | null) => void
}
```

## ref 类型

```ts
// types/ref.ts
export interface DataTableRef {
  refresh: () => Promise<void>
  scrollToRow: (index: number) => void
  clearSelection: () => void
  getSelectedRows: () => unknown[]
}
```

## context 类型

```ts
// types/context.ts
export interface TableContextValue {
  selectedRows: unknown[]
  toggleRow: (row: unknown) => void
  isRowSelected: (row: unknown) => boolean
}
```

## 导入边界

禁止导入：

```ts
// 穿透 src/ 目录
import { formatDate } from '@/components/DataTable/src/utils/date'

// 穿透到具体实现文件
import { useTableSort } from '@/components/DataTable/src/hooks/use-table-sort'

// 相对路径穿透
import { formatDate } from '../../utils/date'
import type { DataTableColumn } from '../../../components/DataTable/src/types/props'
```

允许导入：

```ts
// 通过公开入口导入组件和类型
import { DataTable } from '@/components/DataTable'
import type { DataTableProps, DataTableColumn, DataTableRef } from '@/components/DataTable'

// 使用路径别名
import { DataTable, type DataTableProps } from '@/components/DataTable'
```

## 组件内部导入

```tsx
// 组件内部可以使用相对路径
import type { DataTableProps } from './types'
import { useTableSort } from './hooks/use-table-sort'
import { HeaderCell } from './components/HeaderCell'
```
