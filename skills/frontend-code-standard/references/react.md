# React Standard

## Component Directory

```text
FormDrawer/
  index.tsx
DetailDrawer/
  index.tsx
ConfirmDialog/
  index.tsx
```

## Hook Boundary

Hooks should contain state, derived state, data loading, validation orchestration, and user actions. Components should render and wire events.

```tsx
/**
 * 管理用户列表页的查询、分页和加载状态。
 *
 * 不处理弹窗显隐和路由跳转；接口异常保持抛出，交由页面统一错误处理。
 */
export function useUserList() {}
```

```tsx
const formDrawerRef = useRef<FormDrawerRef>(null)
const detailDrawerRef = useRef<DetailDrawerRef>(null)
```

## JSX And Events

Use camelCase props and `handle`-prefixed event functions:

```tsx
<DataTable
  loading={loading}
  columns={columns}
  onSelectionChange={handleSelectionChange}
/>
```

```tsx
/**
 * 同步表格选中项。
 *
 * 只接收表格组件抛出的完整选中列表，不在此处重新过滤业务权限。
 */
function handleSelectionChange() {}
```

Keep components pure. Do not mutate props, hide side effects in render, or mix API orchestration into presentational components.
