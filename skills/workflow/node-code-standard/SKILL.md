---
name: node-code-standard
description: 用于新建、编写、重构、拆分、优化、评审或校验非 NestJS 的 Node.js/TypeScript/JavaScript 后端代码，覆盖模块边界、契约校验、事务、持久化、错误映射和集成边界。
---

# Node 后端架构与实现准则

## 1. 核心定位

本 Skill 用于规范非 NestJS 的 Node.js 后端代码，覆盖 TypeScript 与 JavaScript 项目的新建、重构、Review 和质量校验场景。

执行原则：面向目标重建，拒绝为了兼容历史遗留而保留冗余 Facade、伪分层、旧 DTO、旧错误映射、过渡 Mapper 或空壳目录。旧结构阻碍当前目标时，直接按本准则重建边界。

本文件是 Node 后端实现标准的唯一规则源。不要跳转到仓库中的其它 project skills 作为实现依据；只有当前项目真实代码、当前任务约束和本 Skill 内规则生效。

## 2. 使用场景

当任务目标是新增接口、重构模块、收敛 service 职责、补齐输入校验、调整事务边界、整理 repository 越界逻辑、统一错误映射，或规范 Node 后端目录与分层时，使用本 Skill。

本 Skill 只面向非 NestJS 的 Node.js 后端代码。NestJS 项目使用 `nestjs-code-standard`。

## 3. 工作顺序

1. 先确认业务能力、外部契约、模块边界、事务要求、持久化模型、并发要求、HTTP 框架及版本、当前项目使用的 Node 基础设施。
2. 判断代码应留在当前 Feature 模块内，还是按领域通用性提升为全局基础设施、跨域业务资产或模块内共享支持。
3. 优先复用项目已有成熟库和框架能力，例如 HTTP 框架、schema 校验库、ORM、SQL builder、迁移工具、日志库、安全中间件、限流组件和测试工具。
4. 直接按目标职责重建 route、schema、application、domain、infrastructure 和装配关系，不保留无价值兼容层。
5. 完成后按风险执行项目已有 lint、typecheck、test、build、启动验证、集成测试或契约验证；缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

## 4. 模块与架构边界

采用 Feature-First 目录组织，严格执行 Dependency Inversion，静态依赖方向必须始终指向内层：`Transport -> Application -> Domain`。

- 依赖反转与装配：`Infrastructure` 绝对不能被 `Domain` 依赖。`Infrastructure` 只能通过实现 `Application` 或 `Domain` 层定义的接口（Port/Adapter）完成外部系统适配，并在 Composition Root（装配入口）完成依赖注入。
- 单一职责与文件拆分：严禁文件承担过多职责。当 Service、Controller 或 Domain 逻辑过载时，必须按领域行为或独立可测试边界进行拆分。
- Utility 收敛防腐：纯技术工具（如加密、时间处理）可放入全局 `shared/utils`，但业务 Helper 默认必须留在 Feature 模块内部。跨域业务能力应按领域命名上浮，严格禁止将 `shared/utils` 作为泛化的“业务逻辑垃圾桶”。
- Transport（契约层）：仅处理路由、参数提取、输入校验与协议状态，只负责让错误进入统一 Error Boundary，错误映射由全局 Error Middleware / `setErrorHandler` 完成。禁止在此层编排跨域流程或直接操作仓储。
- Application（编排层）：负责 UseCase 编排与事务边界。接收 Command/Query，返回领域结果。禁止透传 HTTP 框架原生对象（`req` / `res` / `reply`）。
- Domain（领域层）：承载聚合、值对象与核心规则。与基础设施完全解耦。
- Infrastructure（基建层）：封装 ORM、第三方 SDK 与底层事务。禁止反向污染上层。

推荐目录形态：

```text
src/modules/orders/
  transport/
    orders.controller.ts
    schemas/
      create-order.request.ts
      list-orders.query.ts
    presenters/
      order.presenter.ts
  application/
    create-order.service.ts
    commands/
      create-order.command.ts
    ports/
      order-unit-of-work.ts
      payment-reservation-outbox.ts
  domain/
    order.aggregate.ts
    order.repository.ts
    order.errors.ts
    value-objects/
      order-id.ts
  infrastructure/
    persistence/
      postgres-order.repository.ts
      postgres-order-unit-of-work.ts
    integrations/
      payment-gateway.client.ts
```

## 5. 契约与输入输出边界

- SSOT（Single Source of Truth）：外部输入输出边界（HTTP、RPC、Event、Job、Config 等 Contract Boundary）必须由 Schema（如 Zod、Valibot、TypeBox、AJV 或项目既有方案）保证运行时强校验。此边界内的 TypeScript 静态类型必须由 Schema 推导（如 `z.infer`），绝对禁止手写同名 Interface 造成双写漂移。
- 业务语义解绑：Domain 层的 Entity、Value Object 以及 Application 层的 UseCase Command 必须是纯粹的业务语义类型，不应强制从 Transport Schema 推导，避免业务层被底层校验框架绑架。
- 失败显性化：契约不符时必须抛出明确错误，严禁吞错、空对象回退或返回伪成功状态。
- 配置读取必须集中装配并通过 Schema 校验，不得到处直接读取未经校验的 `process.env`。
- DTO、领域对象、持久化模型分离；除非项目已明确接受耦合，否则不要直接把 ORM model 或数据库行对象暴露给 API。

## 6. 事务与持久化隔离

- UseCase 级事务封装：事务边界必须收敛在 Application 层。
- 禁止事务句柄泄漏：严禁将底层事务对象（如 `Knex.Transaction`、`Prisma.TransactionClient`、`Sequelize.Transaction`、TypeORM `EntityManager`）作为参数透传给 Domain 或 Application 层。必须通过 `UnitOfWork` 模式或基于 `AsyncLocalStorage` 的上下文进行封装隔离。
- 禁用长事务：涉及高风险或高耗时的外部副作用（如远程调用、支付预占）时，禁止与数据库同步大事务混编，强制采用 Outbox Pattern 或异步补偿机制。
- Repository 只负责持久化访问和映射，Gateway 只负责持久化或外部依赖访问，不承担 HTTP 拼装、鉴权决策、缓存编排或跨聚合业务流程。
- 数据库结构变更必须通过项目现有迁移机制表达，例如 Prisma Migrate、Drizzle Kit、Knex migration、TypeORM migration 或 Sequelize migration；不得手工假设线上表结构。

## 7. 异步控制与错误边界

- 全局错误收口：必须在框架顶级统一映射错误码与响应体，业务错误必须在请求级或任务级 Error Boundary 内处理。
- 异步错误可达（Async Error Propagation）：
  - Express 4：严禁挂载裸 `async` Route Handler，必须包裹 `asyncHandler`，确保 Promise Rejection 被转发到全局 Error Middleware。
  - Express 5：原生支持 Promise Rejection 转发，但必须进行版本确认，并通过协议级集成测试（如 Supertest）验证错误拦截，禁止机械添加冗余 Wrapper。
  - Fastify：必须注册 `setErrorHandler` 或项目统一 error plugin；Route 不得 catch 后返回伪成功。
- 防事件循环阻塞（Event Loop Unblocking）：严禁在主线程执行同步深拷贝、超大 JSON 序列化或高风险正则（ReDoS）。必须采用 Stream、Backpressure 或 Offloading（`worker_threads` / 后台任务）。
- Crash 语义与优雅退出（Graceful Shutdown）：进程级 Crash Handler 仅作为最后防线，用于处理逃逸的不可恢复错误（`uncaughtException` / `unhandledRejection`），此时必须记录日志并主动退出进程。Entrypoint 必须拦截 `SIGINT/SIGTERM`，停止接收新请求并安全释放所有连接。

## 8. 可观测性与安全基线

- 安全入口防护：Entrypoint 强制配置 Helmet（安全头）、全局限流（Rate Limiting）与严格的 CORS allowlist。
- 结构化日志与脱敏：强制使用 Pino、Winston 或项目既有结构化日志库输出纯 JSON 日志。严禁使用 `console.log` 拼接服务日志，必须在 Logger 层配置 PII（如密码、Token、证件号、手机号、邮箱、地址）的自动 Redaction。
- ALS 追踪：跨异步边界传递请求上下文（Trace ID、Tenant ID、Request ID）必须使用 Node 原生 `AsyncLocalStorage`，禁止侵入式修改业务函数签名。
- 外部 HTTP client 必须具备 timeout、错误映射和可观测性；涉及高风险依赖时优先使用 Circuit Breaker、Bulkhead 或限流策略，避免级联故障。

## 9. 队列、任务与集成边界

- 队列、定时任务和事件消费者也必须遵守相同分层：handler 负责协议入口，Application 负责编排，Infrastructure 负责外部系统适配。
- 消费者失败必须进入明确失败语义，例如 nack、retry、dead-letter queue 或显式错误返回。
- 禁止失败后 ack 伪成功，禁止后台任务悬空 Promise。

## 10. 测试边界

- Domain 与 Application 以纯单元测试为主：聚合、值对象、领域服务和 Application Service 必须在不启动 HTTP 框架、不连接真实数据库、不加载外部 SDK 的情况下验证业务规则与编排；Repository、UnitOfWork、消息发布器和外部 Client 通过接口 Mock 或 Fake 注入。
- Infrastructure 以集成测试为主：Repository、迁移、SQL builder、ORM 映射和外部适配器不得 Mock 数据库驱动来伪造通过，必须使用 Testcontainers、项目标准测试数据库或同等真实依赖验证数据库方言、约束、事务和映射行为。
- Transport 以协议边界集成测试为主：Express 路由使用 Supertest，Fastify 路由使用 `fastify.inject()` 或项目等价工具，覆盖 Schema 校验、认证上下文、错误映射、异步错误传播、状态码和 Response Presenter；不要直接调用 Controller 函数假装完成 HTTP 契约测试。
- Entrypoint 和生命周期代码至少要有可执行验证策略：能证明 `SIGINT/SIGTERM` 会触发拒绝新请求、关闭 Server、关闭数据库/队列/缓存连接并在超时后退出。

## 11. GraphQL 场景说明

本 Skill 主要面向 REST/HTTP API 场景。GraphQL 项目可参考以下适配：

- Resolver 对应 Transport 层：负责参数提取、认证上下文读取、Schema 校验和响应映射，不直接编排跨仓储流程。
- Query/Mutation 输入校验：优先使用 GraphQL Schema 的类型约束，复杂业务校验仍需在 Application 层补充。
- GraphQL 类型与运行时 Schema 同样需要 SSOT，不得同时维护一套 Schema、一套重复 TypeScript Interface 和一套手写 DTO。
- DataLoader 用于解决 N+1 问题，属于 Infrastructure 层的数据访问优化，不承载业务逻辑。
- Subscription 的长连接和事件推送协议适配属于 Transport 层，事件产生和订阅管理属于 Application 层。

分层原则同样适用，只是 Transport 入口从 HTTP Route 变为 GraphQL Resolver。

## 示例

### 运行时契约与 SSOT

```ts
import { z } from 'zod'

export const createOrderRequestSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    sku: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
})

export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>

export interface CreateOrderCommand {
  customerId: string
  items: Array<{
    sku: string
    quantity: number
  }>
}

export function toCreateOrderCommand(input: CreateOrderRequest): CreateOrderCommand {
  return {
    customerId: input.customerId,
    items: input.items,
  }
}
```

### Express asyncHandler

```ts
import type { NextFunction, Request, Response } from 'express'

type AsyncRouteHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
) => Promise<unknown>

export function asyncHandler(handler: AsyncRouteHandler) {
  return (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}
```

### Fastify 路由与错误收口

```ts
export function registerOrderRoutes(app: FastifyInstance, deps: OrderModuleDeps) {
  app.post('/orders', async (request, reply) => {
    const input = createOrderRequestSchema.parse(request.body)
    const result = await deps.createOrderService.execute(toCreateOrderCommand(input))

    return reply.code(201).send(orderPresenter.toResponse(result))
  })
}

app.setErrorHandler((error, request, reply) => {
  const mapped = mapErrorToHttpResponse(error)
  reply.code(mapped.statusCode).send(mapped.body)
})
```

### UnitOfWork 与 Outbox

```ts
export interface OrderUnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>
}

export class CreateOrderService {
  constructor(
    private readonly unitOfWork: OrderUnitOfWork,
    private readonly orderRepository: OrderRepository,
    private readonly paymentReservationOutbox: PaymentReservationOutbox,
  ) {}

  async execute(command: CreateOrderCommand) {
    return this.unitOfWork.run(async () => {
      const order = OrderAggregate.create(command)

      await this.orderRepository.save(order)

      // 远程支付预占不可随数据库事务回滚，先写 Outbox 交给异步 worker 执行。
      await this.paymentReservationOutbox.enqueue({
        orderId: order.id.value,
        amount: order.totalAmount,
      })

      return order
    })
  }
}
```

## 12. AI / 代码评审执行指令

当执行代码 Review 任务时，必须严格比对上述准则。直接输出以下结构，禁止输出无关客套话或泛泛而谈的优化建议。

### 必须包含

1. 目标分类
2. 检查范围
3. 评审结论
4. 问题清单
5. 行动项汇总
6. 验证状态

### 状态定义

- `PASS`：已检查范围内未发现违反准则的问题。
- `FAIL`：验证命令执行失败，或发现明确违反本准则的代码问题。
- `MISSING`：缺少必要的脚本、依赖、配置、测试入口或实现入口。
- `NOT RUN`：存在验证入口但未实际执行检查，必须说明原因。
- `N/A`：当前任务与该检查项无关，必须说明不适用原因。

### 目标分类

目标分类只能使用 `entrypoint`、`transport-module`、`application-module`、`domain-module`、`infrastructure-adapter`、`shared-support` 或 `mixed-module`。

### 每个问题都必须包含

- 严重级别：`critical`、`major` 或 `minor`
- 规则点
- 位置：文件路径及行号
- 说明：明确指出违反了哪条具体约束，例如 Schema 双写漂移、泄漏事务句柄、主线程阻塞风险
- 行动项：给出可直接执行的代码修改建议或重构落点

### 输出约束

- 检查范围必须说明实际阅读的文件、目录、调用链或验证命令；未检查部分标记 `NOT RUN`。
- 不得把脚本 `PASS`、未检查项或缺少脚本写成整体 `PASS`。
- 不得只写“建议优化”“建议调整”“建议规范化”这类空泛建议。

### 评审输出示例

- 目标分类：`application-module`
- 检查范围：`src/modules/orders/application/create-order.service.ts`、`src/modules/orders/transport/orders.controller.ts`
- 评审结论：`FAIL`

1. `major`
   - 规则点：Application 禁止透传 HTTP 框架原生对象。
   - 位置：`src/modules/orders/application/create-order.service.ts:12`
   - 说明：`CreateOrderService` 直接接收 Fastify `request` 对象并从中读取 body 与 headers，导致 Application 与 Transport 框架强耦合。
   - 行动项：在 `src/modules/orders/application/commands/create-order.command.ts` 建立明确 Command，由 `src/modules/orders/transport/orders.controller.ts` 负责把请求映射为 Command。

2. `critical`
   - 规则点：禁止事务句柄泄漏。
   - 位置：`src/modules/orders/application/create-order.service.ts:24`
   - 说明：`CreateOrderService` 接收 `Prisma.TransactionClient`，导致 Application 直接依赖底层 ORM 事务对象。
   - 行动项：引入 `OrderUnitOfWork.run()`，由 Infrastructure 内部管理 Prisma 事务句柄，Application 只依赖 UnitOfWork Port。

## 13. 检查清单

1. 是否确认业务能力、外部契约、模块边界、事务要求、持久化模型、并发要求、HTTP 框架及版本？
2. 目标分类是否明确为允许的七类之一？
3. Transport 是否只处理协议适配、Schema parse、Response Presenter 和 Async Error Propagation？
4. Express 4 是否没有裸 `async` Route Handler？
5. Express 5 是否确认版本并覆盖 Promise Rejection 转发测试？
6. Fastify 是否注册统一 `setErrorHandler` 或 error plugin？
7. Contract Boundary 是否通过成熟 Schema 或框架能力表达运行时契约？
8. TypeScript 类型是否从 Schema / type provider 推导，没有 Schema / Interface 双写漂移？
9. Application 是否只接收 Command / Query，不接收 `req`、`res`、`reply`？
10. Application 是否承担 UseCase 编排与事务边界，而不是把编排散落到 Route、Middleware、Hook 或 Repository？
11. Domain 是否不依赖 HTTP、ORM、SDK、消息协议、配置读取和事务句柄？
12. Infrastructure 是否只实现端口，不污染上层类型？
13. 是否没有 `Knex.Transaction`、`Prisma.TransactionClient`、`Sequelize.Transaction`、`EntityManager` 泄漏到 Application / Domain？
14. 是否没有把远程调用、支付预占、Webhook、邮件短信混入数据库长事务？
15. Repository 是否只负责持久化访问和映射，没有夹带跨聚合业务流程？
16. 数据库结构变更是否通过迁移机制表达？
17. 配置是否集中读取并通过 Schema 校验？
18. 是否启用安全响应头、严格 CORS allowlist 和全局 Rate Limiting？
19. 日志是否为结构化 JSON，并配置 PII / Token Redaction？
20. 是否使用 `AsyncLocalStorage` 或等价机制维护请求上下文？
21. 是否处理 `SIGINT/SIGTERM` 并实现 Graceful Shutdown？
22. `uncaughtException` / `unhandledRejection` 是否记录 fatal 并退出进程？
23. 是否没有主线程大对象同步处理、CPU 密集同步任务或 ReDoS 风险？
24. 外部 HTTP client 是否有 timeout、错误映射和重试预算？
25. 队列、定时任务、事件消费者是否有明确失败语义？
26. 测试边界是否符合分层职责？
27. Transport 集成测试是否覆盖异步错误进入统一 Error Boundary？
28. 是否运行与风险匹配的 lint、typecheck、test、build、启动验证或集成测试？
29. 缺少脚本、依赖或验证入口时是否标记 `MISSING`？
30. 未执行项是否标记 `NOT RUN` 并说明原因？

## 14. 自校验脚本

- `node scripts/verify-rules.mjs`
- `node scripts/verify-rules.mjs hoist --target src/shared/order-formatters --uses src/modules/orders/create/create-order.service.ts src/modules/orders/update/update-order.service.ts src/modules/orders/cancel/cancel-order.service.ts`

自校验脚本应至少覆盖以下关键词和结构：

- `Feature-First`
- `Dependency Inversion`
- `Composition Root`
- `Contract Boundary`
- `SSOT`
- `z.infer`
- `Async Error Propagation`
- `asyncHandler`
- `Promise Rejection`
- `Error Middleware`
- `setErrorHandler`
- `UnitOfWork`
- `AsyncLocalStorage`
- `Knex.Transaction`
- `Prisma.TransactionClient`
- `Sequelize.Transaction`
- `EntityManager`
- `Outbox Pattern`
- `Graceful Shutdown`
- `SIGINT/SIGTERM`
- `uncaughtException`
- `unhandledRejection`
- `Backpressure`
- `worker_threads`
- `ReDoS`
- `Rate Limiting`
- `CORS allowlist`
- `Redaction`
- `Testcontainers`
- `Supertest`
- `fastify.inject()`
- `PASS`
- `FAIL`
- `MISSING`
- `NOT RUN`

脚本 `PASS` 只代表 Skill 文档规则存在；不能替代对真实业务代码的 lint、typecheck、test、build、启动验证和集成测试。

`verify-rules.mjs hoist` 的 `[HOIST_WARNING]` 只表示共享边界存在机械风险信号，必须人工结合领域语义复核，不能把扫描 `PASS` 当作实现整体通过。
