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
import { useOrderDetail, useUserList } from '../hooks'
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
// 提交当前筛选条件并刷新列表，不负责修改筛选模型。
function handleSearch() { }

// 同步表格选中项，输入必须来自表格组件的 selection 事件。
function handleSelectionChange() { }

// 发起审核流程，调用前必须已确认目标记录和权限上下文。
function handleAudit() { }
```
