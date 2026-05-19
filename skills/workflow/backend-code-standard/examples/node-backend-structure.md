# Node.js 后端结构示例

本文件只提供 Fastify、Express、Koa、Nitro/H3 示例，不定义新规则；规则以 `SKILL.md` 为准。

## 垂直切片模块

```text
modules/
  orders/
    controller.ts
    service.ts
    repository.ts
    dtos/
      create-order.ts
      update-order.ts
      order-response.ts
      index.ts
    types/
      order.ts
      order-record.ts
      index.ts
    constants/
      order-status.ts
      index.ts
    utils/
      price-calculator.ts
      index.ts
    index.ts
```

## DTO 与类型出口

```ts
// dtos/index.ts
export * from './create-order'
export * from './update-order'
export * from './order-response'
```

```ts
// types/index.ts
export type * from './order'
export type * from './order-record'
```

## 导入边界

禁止：

```ts
import { OrderService } from '../../orders/service'
import { OrderService } from '@/modules/orders/service'
```

允许：

```ts
import { OrderService } from '@/modules/orders'
```

## 运行时校验

Fastify / Nitro / H3 可在路由边界接入 JSON Schema、Zod、TypeBox 或框架支持的 validator。
Express / Koa 必须在路由或 middleware 边界完成输入校验，再调用 Service。

```ts
const createOrderSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
})
```

## 局部上浮示例

```text
modules/
  orders/
    create/service.ts
    update/service.ts
    cancel/service.ts
    utils/
      price-calculator.ts
```

`create`、`update`、`cancel` 三处复用时，先上浮到 `orders/utils/`，不是直接进 `src/utils/`。
