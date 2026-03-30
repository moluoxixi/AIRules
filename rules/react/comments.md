# React Comments

Documentation conventions for React / Next.js projects.

> **注释语言**：注释语言跟随项目所在地区，详见 [common/comments.md](../common/comments.md)。代码示例使用中文注释。

## Component Documentation

Document component purpose, props, and behavior:

```tsx
/**
 * 展示带搜索筛选功能的分页用户卡片列表
 * 在组件挂载和筛选条件变化时自动获取数据
 *
 * @example
 * <UserList
 *   pageSize={20}
 *   onUserSelect={(user) => router.push(`/users/${user.id}`)}
 * />
 */
export function UserList({ pageSize, onUserSelect }: UserListProps) {
```

## Props Interface Documentation

```tsx
interface UserListProps {
  /** 每页显示的项目数量（默认：10） */
  pageSize?: number;

  /** 用户点击卡片时的回调 */
  onUserSelect?: (user: User) => void;

  /** 筛选的初始搜索关键词 */
  initialQuery?: string;
}
```

## Hooks Documentation

```tsx
/**
 * 管理分页状态，支持与 URL 同步
 * 页码变化时更新浏览器历史记录
 *
 * @param totalItems - 用于计算最大页码的总数
 * @param itemsPerPage - 每页显示的项目数量
 * @returns 当前页码、总页数和页码变化处理器
 *
 * @example
 * const { page, totalPages, setPage } = usePagination(100, 20);
 */
export function usePagination(totalItems: number, itemsPerPage: number) {
```

## Server Component Documentation

```tsx
/**
 * Server Component，获取商品详情
 * 为公开商品在构建时渲染静态 HTML
 *
 * @param params - 包含商品 slug 的路由参数
 */
export default async function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = await getProduct(params.slug);
  // ...
}
```

## Client Component Marker

```tsx
'use client';

/**
 * 带防抖 onChange 的交互式搜索输入框
 * Client Component - 需要 JavaScript
 */
export function SearchInput({ onSearch }: SearchInputProps) {
```
