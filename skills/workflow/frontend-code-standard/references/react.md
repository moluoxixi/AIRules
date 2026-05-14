# React 规范

## 组件目录

```text
FormDrawer/
  index.tsx
DetailDrawer/
  index.tsx
ConfirmDialog/
  index.tsx
```

## Hook 边界

Hook 适合承载状态、派生状态、数据加载、校验编排和用户动作。组件负责渲染和事件装配。

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

## JSX 与事件

props 使用 camelCase，事件函数优先使用 `handle` 前缀：

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

保持组件纯净。不要修改 props，不要在 render 中隐藏副作用，也不要把 API 编排混入展示组件。
