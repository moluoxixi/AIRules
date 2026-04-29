# React 代码风格

## 文件结构 — 单一文件或目录+index

```
FormDrawer/
├── index.tsx
DetailDrawer/
├── index.tsx
ConfirmDialog/
├── index.tsx
```

## 组件目录 — PascalCase，入口 `index`

```
FormDrawer/
├── index.tsx
DetailDrawer/
├── index.tsx
```

## 组件 ref — 小驼峰 + Ref 后缀

```tsx
const formDrawerRef = useRef<FormDrawerRef>(null)
const detailDrawerRef = useRef<DetailDrawerRef>(null)
```

## Hooks — `use` + 大驼峰

```tsx
import { useUserList } from '../hooks'
import { useOrderDetail } from '../hooks'
```

## JSX 属性 — camelCase

```tsx
<DataTable
  loading={loading}
  columns={columns}
  onSelectionChange={handleSelectionChange}
/>
```

## 事件处理函数 — handle + 大驼峰描述

```tsx
function handleSearch() { }
function handleSelectionChange() { }
function handleAudit() { }
```
