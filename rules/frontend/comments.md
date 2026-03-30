# Frontend Comments

Cross-framework documentation conventions for frontend projects.

> **注释语言**：注释语言跟随项目所在地区，详见 [common/comments.md](../common/comments.md)。代码示例使用中文注释。

## Core Principles

- 注释语言跟随项目所在地区，详见 [common/comments.md](../common/comments.md)
- Document **why** and **constraints**, not obvious behavior
- Focus on business semantics, side effects, and edge cases
- Don't repeat type information already in TypeScript

## JSDoc/TSDoc Basics

```typescript
/**
 * 计算带阶梯折扣的折后价格
 *
 * @param basePrice - 折扣前的原价
 * @param quantity - 用于计算批量折扣的商品数量
 * @returns 应用所有适用折扣后的最终价格
 * @throws Error basePrice 为负数时抛出
 */
function calculatePrice(basePrice: number, quantity: number): number {
```

## Component Comments

Document component purpose and important props:

```typescript
/**
 * 渲染支持排序、筛选和分页的数据表格
 *
 * 性能说明：列表超过 1000 项时使用虚拟化
 */
interface DataTableProps<T> {
  /** 要显示的数据行 */
  data: T[];

  /** 带渲染器的列定义 */
  columns: ColumnDef<T>[];

  /** 行选择变化时调用 */
  onSelectionChange?: (selected: T[]) => void;
}
```

## Style Comments

```css
/* 组件：Card
   用于商品列表和用户资料
   支持悬停状态和加载骨架屏 */
.card {
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

/* 修饰符：Card 高亮状态
   当项目被选中或推荐时应用 */
.card--highlighted {
  border-color: var(--color-primary);
}
```

## Complex Logic Comments

```typescript
// 防抖搜索输入以避免过多的 API 调用
// 300ms 延迟在响应性和服务器负载间取得平衡
const debouncedSearch = useDebounce(searchQuery, 300);

// NOTE: 此 workaround 处理 Safari 的 flexbox 溢出 bug
// 当不再支持 Safari 15 时可移除
const safariFix = { minHeight: 0 };
```

## File Header Comments

```typescript
/**
 * @file 用户认证工具
 * @description 处理 JWT token 管理、会话持久化
 *   和过期前的自动 token 刷新
 */
```

## Avoid

- Comments that repeat variable names
- Outdated comments; update or delete
- Commenting every line of obvious code
