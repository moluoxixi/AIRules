# TypeScript And JavaScript Standard

## TypeScript Types

```ts
/**
 * 用户列表行记录，字段直接对齐用户列表接口。
 */
interface UserRecord {
  userId: number
  userName: string
  createdAt: string
}

/**
 * 订单列表查询参数，只包含前端会主动提交的筛选条件。
 */
interface OrderQueryParams {}
```

## Constants

```ts
/**
 * 列表默认每页条数，需与后端分页上限保持一致。
 */
export const DEFAULT_PAGE_SIZE = 10

/**
 * 状态展示文案映射，只覆盖前端可识别的订单状态。
 */
export const statusLabelMap = {}
```

## API Functions

```ts
/**
 * 获取用户列表。
 *
 * 只透传后端分页结果，接口失败时保持异常抛出，由调用方处理错误提示。
 */
export function getUserList() {}
```

## JavaScript Functions

```js
/**
 * 将业务日期值格式化为页面展示文本。
 *
 * 调用方必须保证传入值已通过日期合法性校验，本函数不吞掉解析失败。
 */
function formatDate(date) {
  return new Intl.DateTimeFormat('zh-CN').format(new Date(date))
}
```

Prefer TypeScript contracts over defensive runtime normalization for internal data. Use runtime validation for user input, third-party data, or untrusted external responses.
