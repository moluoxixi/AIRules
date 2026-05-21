# React 组件示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 简单组件

```text
components/
  StatusBadge.tsx
  UserAvatar.tsx
  InlineChart.tsx
  LoadingSpinner.tsx
```

简单组件优先保持单文件。只有出现复用逻辑、复杂契约或独立包级 API 时，才升级为复杂组件包。

## 复杂组件包

```text
DataTable/
  README.md
  index.ts
  src/
    index.tsx
    hooks/
      index.ts
      use-table-sort.ts
      use-table-filter.ts
    components/
      index.ts
      HeaderCell.tsx
      BodyRow.tsx
      EmptyState.tsx
      Pagination.tsx
    types/
      props.ts
      ref.ts
      context.ts
      index.ts
    utils/
      index.ts
      normalize-column.ts
    styles/
      index.css
      data-table.module.css
```

## Props 与 Ref 示例（React 19+）

```tsx
import { useImperativeHandle, useMemo, useState } from 'react'
import type { DataTableColumn } from './types'

interface DataTableProps {
  columns: DataTableColumn[]
  data: unknown[]
  loading?: boolean
  emptyText?: string
  selected?: unknown[]
  onSelectedChange?: (rows: unknown[]) => void
  onRowClick?: (row: unknown, index: number) => void
  onSort?: (column: string, order: 'asc' | 'desc') => void
  ref?: React.Ref<DataTableRef>
}

interface DataTableRef {
  refresh: () => void
  scrollToRow: (index: number) => void
}

function DataTable({
  columns,
  data,
  loading = false,
  emptyText = 'No data',
  selected,
  onSelectedChange,
  onRowClick,
  onSort,
  ref,
}: DataTableProps) {
  const tableRef = useRef<HTMLTableElement>(null)

  useImperativeHandle(ref, () => ({
    refresh: () => { /* ... */ },
    scrollToRow: (index: number) => { /* ... */ },
  }))

  const isEmpty = data.length === 0 && !loading

  return (
    <table ref={tableRef}>
      {/* ... */}
    </table>
  )
}
```

## Props 与 Ref 示例（React 18）

```tsx
import { forwardRef, useImperativeHandle, useRef } from 'react'

interface DataTableProps {
  columns: DataTableColumn[]
  data: unknown[]
  loading?: boolean
}

interface DataTableRef {
  refresh: () => void
  scrollToRow: (index: number) => void
}

const DataTable = forwardRef<DataTableRef, DataTableProps>(
  function DataTable({ columns, data, loading = false }, ref) {
    const tableRef = useRef<HTMLTableElement>(null)

    useImperativeHandle(ref, () => ({
      refresh: () => { /* ... */ },
      scrollToRow: (index: number) => { /* ... */ },
    }))

    return <table ref={tableRef}>{/* ... */}</table>
  },
)
```

## Context 示例

```tsx
// context/table-context.ts
import { createContext, useContext } from 'react'

interface TableContextValue {
  selectedRows: unknown[]
  toggleRow: (row: unknown) => void
}

const TableContext = createContext<TableContextValue | null>(null)

function useTableContext(): TableContextValue {
  const context = useContext(TableContext)
  if (!context) {
    throw new Error('useTableContext must be used within DataTable')
  }
  return context
}

export { TableContext, useTableContext }

// 父组件 provide
function DataTable({ children }: { children: React.ReactNode }) {
  const [selectedRows, setSelectedRows] = useState<unknown[]>([])
  const toggleRow = (row: unknown) => { /* ... */ }

  const value = useMemo(
    () => ({ selectedRows, toggleRow }),
    [selectedRows],
  )

  return (
    <TableContext value={value}>
      {children}
    </TableContext>
  )
}

// 子组件 consume
function BodyRow({ row }: { row: unknown }) {
  const { selectedRows, toggleRow } = useTableContext()
  // ...
}
```

## Error Boundary 示例

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  fallback: ReactNode | ((error: Error) => ReactNode)
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

class TableErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('DataTable error:', error, info)
  }

  render() {
    if (this.state.error) {
      const { fallback } = this.props
      return typeof fallback === 'function'
        ? fallback(this.state.error)
        : fallback
    }
    return this.props.children
  }
}
```

## 公共入口示例

```ts
// DataTable/index.ts
export { default as DataTable } from './src/index'
export type * from './src/types'
```

公共 props 表达调用契约；内部排序、筛选和格式化逻辑不要从包外 deep import。
