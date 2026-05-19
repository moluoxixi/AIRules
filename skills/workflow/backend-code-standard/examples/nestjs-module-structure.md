# NestJS 模块结构示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 领域模块

```text
src/modules/orders/
  orders.controller.ts
  orders.service.ts
  orders.module.ts
  dto/
    create-order.dto.ts
    update-order.dto.ts
    index.ts
  entities/
    order.entity.ts
    index.ts
  constants/
    order-status.ts
    index.ts
  interfaces/
    order-summary.interface.ts
    index.ts
  utils/
    price-calculator.ts
    index.ts
  index.ts
```

## DTO 出口

```ts
// dto/index.ts
export * from './create-order.dto'
export * from './update-order.dto'
```

## 模块边界

```ts
@Module({
  imports: [OrdersModule],
  providers: [CheckoutService],
})
export class CheckoutModule {}
```

跨模块使用 Service 时，目标模块必须通过 `exports` 暴露 provider，调用方通过构造函数注入。

## 导入边界

禁止：

```ts
import { CreateOrderDto } from '../../orders/dto/create-order.dto'
import { OrdersModule } from '@/modules/orders/orders.module'
```

允许：

```ts
import { OrdersModule, CreateOrderDto } from '@/modules/orders'
```

## 异常映射

Service 抛出领域错误或应用错误；Controller、Filter 或全局异常过滤器负责映射 HTTP 响应。
