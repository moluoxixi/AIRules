---
name: nestjs-backend-standard
description: 用于新写或重构 NestJS 后端模块时，约束模块 DI 边界、校验方案、横切职责分离、配置绑定和异常映射；与 backend-implementation-standard 配合使用。
---

# NestJS 后端实现标准

## 使用场景

当任务目标是新写 NestJS 模块、重构 NestJS 服务、整理模块 DI 边界、收敛 Guard/Interceptor/Pipe/Filter 职责，或判断跨模块协作方式是否合理时，使用本 Skill。

本 Skill 只覆盖 NestJS 框架专项约束。通用后端实现原则（契约、事务、一致性、持久化、可观测性）来自 `backend-implementation-standard`，两者配合使用。

## 工作顺序

1. 先确认项目 NestJS 版本、既有模块结构、DI 约定、校验方案和异常处理基线。
2. 判断当前改动属于 Module、Controller、Service、Provider、Guard、Interceptor、Pipe 还是 Filter。
3. 先复用项目已有的校验方案、配置模块、异常过滤器和日志方案。
4. 按 NestJS 模块边界和 DI 契约实现，不绕过框架机制。
5. 完成后按风险运行项目已有 lint、typecheck、test、build 或集成验证；缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

## 实现原则

- 模块自治：每个 NestJS Module 是一个自治边界；跨模块协作通过 `imports`、`exports` 和构造函数注入完成。
- 禁止绕过 DI：禁止 `new Service()`、字段注入或跨模块直接拿私有 provider。
- 校验跟随项目：默认跟随项目既有 NestJS 校验方案；若项目没有既有约定，优先使用 class DTO、`class-validator` 和 `ValidationPipe`，或使用项目统一的 schema pipe 方案。
- 横切职责单一：Guard、Interceptor、Pipe、Filter 各自承担单一横切职责，不在其中混入核心业务规则。
- 配置类型化：`@nestjs/config`、自定义配置模块或等价方案应承载配置绑定，不在 provider 内零散读取环境变量。
- 异常映射清晰：Service 抛出领域错误或应用错误；Controller、Exception Filter 或全局异常映射层负责转换 HTTP 响应。

## 模块结构

NestJS 模块可以使用分层结构或扁平结构，取决于模块复杂度：

### 分层结构（复杂模块）

```text
src/modules/orders/
  orders.module.ts
  http/
    orders.controller.ts
    dto/
      create-order.dto.ts
  application/
    create-order.service.ts
  domain/
    order.errors.ts
  infrastructure/
    order.repository.ts
```

### 扁平结构（简单模块）

```text
src/modules/notifications/
  notifications.module.ts
  notifications.controller.ts
  notifications.service.ts
  dto/
    send-notification.dto.ts
```

两种结构都可接受；选择取决于模块职责复杂度和团队约定。

## 模块协作

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
import { OrdersService } from '@/modules/orders/infrastructure/orders.repository'
import { OrdersService } from '@/modules/orders/http/orders.controller'
```

允许：

```ts
import { OrdersModule } from '@/modules/orders/orders.module'
import { CreateOrderService } from '@/modules/orders/application/create-order.service'
```

## 完成前检查

- 模块 DI 边界是否通过 `imports`/`exports`/构造函数注入完成，没有绕过框架。
- 校验方案是否跟随项目既有约定。
- Guard、Interceptor、Pipe、Filter 是否各自承担单一横切职责。
- 配置是否通过类型化配置模块承载。
- 异常是否保留领域语义，由 Filter 或 Controller 层映射 HTTP 响应。

## 辅助资源

- 校验清单：`validation/checklist.md`
- 自校验脚本：`scripts/verify-rules.mjs`
