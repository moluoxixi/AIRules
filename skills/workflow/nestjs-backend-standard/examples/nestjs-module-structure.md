# NestJS 模块结构示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 分层模块示例

```text
src/modules/orders/
  orders.module.ts
  http/
    orders.controller.ts
    dto/
      create-order.dto.ts
  application/
    create-order.service.ts
    cancel-order.service.ts
  domain/
    order.errors.ts
    order.policy.ts
  infrastructure/
    order.repository.ts
    payment.client.ts
```

## 扁平模块示例

```text
src/modules/notifications/
  notifications.module.ts
  notifications.controller.ts
  notifications.service.ts
  dto/
    send-notification.dto.ts
```

## 模块边界

```ts
@Module({
  imports: [OrdersModule],
  providers: [CheckoutService],
})
export class CheckoutModule {}
```

跨模块协作通过 `imports`、`exports` 和构造函数注入完成。

## 校验方案

若项目已有统一 schema pipe、zod pipe 或自定义校验方案，优先沿用项目约定。
若项目没有既有约定，优先使用 class DTO、`class-validator` 和 `ValidationPipe`。

## 异常映射

Service 抛出领域错误或应用错误；Controller、Exception Filter 或全局异常映射层负责转换 HTTP 响应。
