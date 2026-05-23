---
name: node-code-standard
description: 用于新建、编写、重构、拆分、优化、评审或校验非 NestJS 的 Node.js/TypeScript/JavaScript 后端代码，覆盖模块边界、契约校验、事务、持久化、错误映射和集成边界。
---

# Node 后端实现标准

## 用途

本 Skill 用于新建、编写、重构、拆分、优化、评审或校验非 NestJS 的 Node.js 后端代码，覆盖 TypeScript 与 JavaScript 项目，适用于基于 Express、Fastify、Nest 以外的轻量自建分层、HTTP API、任务处理、事件消费和数据访问代码。

本文件是 Node 后端实现标准的唯一规则源。不要跳转到仓库中的其它 project skills 作为实现依据；只有当前项目真实代码、当前任务约束和本 Skill 内规则生效。

## 使用场景

当任务目标是新增接口、重构模块、收敛 service 职责、补齐输入校验、调整事务边界、整理 repository 越界逻辑、统一错误映射，或规范 Node 后端目录与分层时，使用本 Skill。

本 Skill 面向新实现和重构实现，不面向兼容式修补。旧目录结构、旧 DTO、旧 service、旧 repository、旧事务边界、旧错误映射或旧集成层妨碍当前目标时，直接按标准重建；不要为了兼容历史写法保留冗余 facade、双 service、过渡 mapper、伪分层或空壳目录。

## 工作顺序

1. 先确认业务能力、外部契约、模块边界、事务要求、持久化模型、并发要求和当前项目使用的 Node 基础设施。
2. 判断代码应留在当前 feature module 内，还是按领域通用性提升为全局基础设施、跨域业务资产或模块内共享支持。
3. 优先复用项目已有成熟库和框架能力，例如 HTTP 框架、schema 校验库、ORM、SQL builder、迁移工具、日志库、安全中间件、限流组件和测试工具。
4. 直接按目标职责重建 route、schema、application、domain、infrastructure 和装配关系，不保留无价值兼容层。
5. 完成后按风险执行项目已有 lint、typecheck、test、build、启动验证、集成测试或契约验证；缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

## 实现原则

- 契约优先：HTTP 输入输出、command、query、event、配置和仓储接口必须表达真实边界，不用 `any`、宽泛对象、裸 JSON 或可选字段堆砌掩盖契约。
- 失败显性：依赖、配置、输入、状态或外部调用结果不满足契约时暴露失败，不写吞错、伪成功、空对象回退、静默兼容或无依据默认值。
- 边界清晰：transport 只处理协议层；application 负责用例编排和事务边界；domain 承载业务规则；infrastructure 封装数据库、消息和第三方调用。
- 校验前置：边界输入优先通过 schema 校验库或框架校验机制表达运行时契约；不要只靠 TypeScript 类型假设运行时输入可靠。
- 模块统一：项目必须明确且统一采用 ESM 或 CommonJS。新 TypeScript 项目优先使用 ESM、`type: "module"` 与 `moduleResolution: "NodeNext"`；不得在业务代码中随意混用 `require` 和 `import`，避免 Dual Package Hazard、双实例状态和启动期模块解析失败。
- 依赖显式：统一通过构造参数、工厂函数参数或模块装配显式注入依赖，不写隐式单例、全局可变状态或横向读取容器；对于复杂依赖树，鼓励引入轻量级且无侵入的 DI 容器（如 Awilix）统一装配，保持业务代码对容器零感知。
- 异步可追踪：所有 I/O、任务和事件处理都要明确成功、失败和超时语义，不丢失 Promise、不吞掉 rejection、不写后台悬空任务。
- 事务收敛：事务只放在真正的应用用例边界；除非项目已有明确模式支撑，否则不要把远程调用和数据库事务混成隐式大事务。
- 持久化封装：repository 负责持久化访问和映射，gateway 只负责持久化或外部依赖访问，不承担 HTTP 拼装、鉴权决策、缓存编排或跨聚合业务流程。
- 按领域边界提升：摒弃死板的“三次法则”。出现 2 个明确独立使用点，或逻辑复杂到需要独立测试边界时即可拆分；抽离层级由领域通用性决定，而不是调用方物理最近公共父级。
- 全局基础设施：与具体业务解耦的配置解析、日志、时间、ID、HTTP client、schema 基础工具等，即使当前只有一个使用点，也可以直接提升到全局基础设施层。
- 跨域业务资产：订单状态、支付状态、租户上下文等一旦发生或预期发生跨业务域复用，应提取到共享领域目录或 shared-support，而不是留在某个 feature 的物理父级下。
- 局部业务逻辑：只服务当前 feature module 的 helper、mapper、schema、command 和测试支撑默认留在当前模块内部，不得因为物理路径相近而泄漏到全局 `common`、`shared` 或 `utils`。
- 抽象要付账：不要为了“更像后端架构”机械增加 facade、manager、handler、assembler、util、wrapper 或空 module。
- 注释解释意图：注释只说明事务边界、领域约束、并发保证、外部契约和非显然取舍，不复述代码流程。

## 目标分类

- `entrypoint`：服务启动、环境配置加载、框架初始化、插件挂载、全局中间件、错误处理注册、顶层模块注册、SIGINT/SIGTERM 系统信号处理和进程生命周期管理（含 Graceful Shutdown）。entrypoint 不逐个拼装具体 controller 路由，路由注册由各 `transport-module` 暴露注册函数承接。
- `transport-module`：HTTP route、controller、request/response schema、认证上下文读取、协议适配和模块级路由注册函数。
- `application-module`：以某个业务能力为中心的用例编排层。
- `domain-module`：聚合、值对象、领域服务、领域错误、仓储契约和领域规则。
- `infrastructure-adapter`：数据库仓储实现、第三方 API client、消息实现、缓存、文件存储和任务基础设施。
- `shared-support`：满足真实复用后上浮的共享契约、工具、schema 或支持模块。
- `mixed-module`：当前目录同时混入多层职责，通常意味着需要收敛边界并重构。

## 推荐目录形态

优先使用 feature-first 目录，在 feature 内再表达 `transport`、`application`、`domain`、`infrastructure` 职责。

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
    list-orders.service.ts
    commands/
      create-order.command.ts
  domain/
    order.aggregate.ts
    order.repository.ts
    order.errors.ts
    value-objects/
      order-id.ts
  infrastructure/
    persistence/
      postgres-order.repository.ts
    integrations/
      payment-gateway.client.ts
```

已有项目若稳定使用 route/service/repository 分层，也可以沿用，但必须保持边界清晰，不能因为沿用旧结构就放任跨层耦合。

## 分层职责

### transport

- 处理路由、参数提取、认证上下文读取、输入校验、响应映射和协议状态码。
- transport 不直接编排跨仓储流程，不直接写事务，不直接操作 ORM 实体，不直接实现领域规则。
- request / response schema 只表达传输契约，不承载持久化细节或领域行为。

### application

- 承载 use case 编排、事务边界、权限决策协调、幂等流程和跨仓储流程。
- Service 只做用例编排与事务边界：application service 接收 command / query 或明确 DTO，不把原始 HTTP request 对象透传到 domain 或 infrastructure。
- application service 返回领域结果或稳定响应模型，不返回框架特有 `req`、`res`、`reply` 或原生数据库结果对象。

### domain

- 承载聚合、值对象、领域服务、领域规则、领域错误和仓储接口。
- 领域规则优先放在聚合、值对象或领域服务中，不要散落在 route、middleware、validator 以外的胶水层或 repository 实现里。
- domain 不依赖 HTTP 框架、ORM、SDK 或消息中间件细节；必要时通过接口反转依赖。

### infrastructure

- 放置 ORM model、repository 实现、第三方客户端、消息发布实现、缓存适配器、文件存储和配置适配。
- infrastructure 依赖 domain / application 契约实现，不反向让上层依赖 ORM、SDK、消息协议或数据库驱动细节。

## Node 专项约束

- 运行时输入校验必须使用成熟 schema 方案或框架内建能力，例如 Zod、Valibot、TypeBox、AJV 或项目现有方案；不要手写零散 `if` 链覆盖核心契约。
- 错误映射必须统一收敛到明确边界，例如 error middleware、全局 exception handler 或协议适配层；避免在每个 route 中重复 try/catch 拼装响应。
- 配置读取必须集中装配并校验，不得到处直接读取未经校验的 `process.env`。
- HTTP 安全防护基线必须在 `entrypoint` 或框架插件装配层统一启用：通过 Helmet 或同等级能力设置安全响应头，通过全局 Rate Limiting 限制滥用，通过严格 CORS allowlist 控制来源、方法、请求头与 credentials；不得用全开放 CORS 或无上限入口暴露生产 API。
- 结构化日志必须使用 Pino、Winston 或项目既有结构化日志库，以纯 JSON 输出请求、错误和业务事件；不得用 `console.log` 拼接字符串作为服务日志。日志必须在全局 logger 层配置 Redaction，严禁明文输出密码、Token、Cookie、支付凭证、身份证件号、手机号、邮箱、地址等核心 PII 或凭证数据。
- DTO、领域对象、持久化模型分离；除非项目已明确接受耦合，否则不要直接把 ORM model 或数据库行对象暴露给 API。
- 数据库结构变更必须通过项目现有迁移机制表达，例如 Prisma Migrate、Drizzle Kit、Knex migration、TypeORM migration 或 Sequelize migration；不得手工假设线上表结构。
- 防阻塞主线程：严禁在主线程执行长时间的同步 CPU 密集型操作，如超大 JSON 序列化/反序列化、大对象深拷贝、高成本加密验证或易引发 ReDoS 的复杂正则；必须采用流（Stream）分批处理，或将其移交至 `worker_threads` 及后台异步任务。
- 异步上下文追踪：日志必须保留请求上下文、错误上下文和关键业务标识（如 Request ID、Tenant ID）；跨异步边界传递上下文时必须使用 Node.js 原生的 `AsyncLocalStorage`，绝不允许通过修改 domain / application 层函数签名逐层透传参数；不要记录伪成功，也不要用日志替代错误处理。
- 致命错误与优雅退出：区分可恢复的业务错误与不可恢复的程序错误。发生 `uncaughtException` 或 `unhandledRejection` 时，必须记录日志并主动退出进程（Crash），交由 PM2/K8s 重启，防止内存泄漏或状态污染。必须在 `entrypoint` 实现 Graceful Shutdown，保证退出前拒绝新请求并安全关闭数据库与消息队列连接。
- 并发控制、幂等和重试必须在明确边界内设计；不要靠重复查询、静默覆盖或“多试几次”掩盖竞态。
- 队列、定时任务和事件消费者也必须遵守相同分层：handler 负责协议入口，application 负责编排，infrastructure 负责外部系统适配。

## 测试边界

- domain 与 application 以纯单元测试为主：聚合、值对象、领域服务和 application service 必须在不启动 HTTP 框架、不连接真实数据库、不加载外部 SDK 的情况下验证业务规则与编排；Repository、UnitOfWork、消息发布器和外部 Client 通过接口 Mock 或 Fake 注入。
- infrastructure 以集成测试为主：Repository、迁移、SQL builder、ORM 映射和外部适配器不得 Mock 数据库驱动来伪造通过，必须使用 Testcontainers、项目标准测试数据库或同等真实依赖验证数据库方言、约束、事务和映射行为。
- transport 以协议边界集成测试为主：Express 路由使用 Supertest，Fastify 路由使用 `fastify.inject()` 或项目等价工具，覆盖 schema 校验、认证上下文、错误映射、状态码和响应 presenter；不要直接调用 controller 函数假装完成 HTTP 契约测试。

## 评审输出

### 必须包含

1. 目标分类
2. 检查范围
3. 总结论
4. 问题列表
5. 改动建议汇总

### 每个问题都必须包含

- 编号
- 严重级别：`critical`、`major` 或 `minor`
- 规则点
- 证据：文件路径和位置
- 问题说明：说明为什么不符合当前目标，而不是只复述规则
- 改动建议：给出可直接执行的修改方向、目标文件和建议落点

### 输出约束

- 目标分类只能使用 `entrypoint`、`transport-module`、`application-module`、`domain-module`、`infrastructure-adapter`、`shared-support` 或 `mixed-module`。
- 检查范围必须说明实际阅读的文件、目录、调用链或验证命令；未检查部分标记 `NOT RUN`。
- 总结论只能使用 `PASS`、`FAIL`、`MISSING`、`NOT RUN` 或 `N/A`。
- 不得把脚本 `PASS`、未检查项或缺少脚本写成整体 `PASS`。
- 不得只写“建议优化”“建议调整”“建议规范化”这类空泛建议。

## 完成前检查

- 模块边界是否围绕当前业务能力，而不是继续迁就旧结构。
- transport、application、domain、infrastructure 的职责是否混淆。
- 输入校验、依赖注入、事务边界、错误映射和配置校验是否表达清楚。
- entrypoint 是否只做框架初始化、插件挂载与顶层模块注册，具体路由是否由 transport module 的注册函数承接。
- HTTP 安全头、全局限流、严格 CORS、结构化 JSON 日志和日志 Redaction 是否在全局基础设施层配置。
- ESM 或 CommonJS 模块系统是否统一，没有在业务代码中混用 `require` 与 `import`。
- repository、gateway 和外部依赖是否只承担持久化/集成职责，没有越界承载业务编排。
- 测试边界是否匹配分层：domain/application 使用纯单元测试，infrastructure 使用真实依赖集成测试，transport 通过 HTTP 框架测试入口验证协议契约。
- 共享抽离是否按领域边界判断：全局基础设施、跨域业务资产和局部业务逻辑是否分别落在对应层级，而不是机械依赖物理最近公共父级或“三次法则”。
- 是否运行了与风险匹配的现有 lint、typecheck、test、build、启动验证或集成测试。

## GraphQL 场景说明

本 Skill 主要面向 REST/HTTP API 场景。GraphQL 项目可参考以下适配：

- Resolver 对应 transport 层：负责参数提取、认证上下文读取和响应映射，不直接编排跨仓储流程。
- Query/Mutation 输入校验：优先使用 GraphQL schema 的类型约束，复杂业务校验仍需在 application 层补充。
- DataLoader：用于解决 N+1 问题，属于 infrastructure 层的数据访问优化，不承载业务逻辑。
- Subscription：长连接和事件推送的协议适配属于 transport 层，事件产生和订阅管理属于 application 层。

分层原则（transport → application → domain → infrastructure）同样适用，只是 transport 入口从 HTTP route 变为 GraphQL resolver。

## 示例

### 结构示例

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
    list-orders.service.ts
    commands/
      create-order.command.ts
  domain/
    order.aggregate.ts
    order.repository.ts
    order.errors.ts
    value-objects/
      order-id.ts
  infrastructure/
    persistence/
      postgres-order.repository.ts
    integrations/
      payment-gateway.client.ts
```

### 路由与错误收口

```ts
export function registerOrderRoutes(app: FastifyInstance, deps: OrderModuleDeps) {
  app.post('/orders', async (request, reply) => {
    const input = createOrderRequestSchema.parse(request.body)
    const result = await deps.createOrderService.execute(input)
    return reply.code(201).send(orderPresenter.toResponse(result))
  })
}
```

```ts
app.setErrorHandler((error, request, reply) => {
  const mapped = mapErrorToHttpResponse(error)
  reply.code(mapped.statusCode).send(mapped.body)
})
```

### 运行时契约

```ts
import { z } from 'zod'

export const createOrderRequestSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    sku: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
})

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PAYMENT_API_BASE_URL: z.string().url(),
})

export const env = envSchema.parse(process.env)
```

### 用例编排

```ts
export class CreateOrderService {
  constructor(
    private readonly unitOfWork: OrderUnitOfWork,
    private readonly orderRepository: OrderRepository,
    private readonly paymentGatewayClient: PaymentGatewayClient,
  ) {}

  async execute(command: CreateOrderCommand) {
    return this.unitOfWork.run(async () => {
      const order = OrderAggregate.create(command)
      await this.orderRepository.save(order)
      await this.paymentGatewayClient.reserve(order.totalAmount)
      return order
    })
  }
}
```

### 持久化封装

```ts
export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly db: SqlClient) {}

  async findById(orderId: OrderId) {
    const row = await this.db.oneOrNone<OrderRow>(
      'select * from orders where id = $1',
      [orderId.value],
    )

    return row ? OrderMapper.toAggregate(row) : null
  }
}
```

### 评审输出示例

- 目标分类：`application-module`
- 检查范围：`src/modules/orders/application/create-order.service.ts`、`src/modules/orders/transport/orders.controller.ts`、`src/modules/orders/infrastructure/persistence/postgres-order.repository.ts`
- 总结论：`FAIL`

1. `major`
   - 规则点：application 负责用例编排和事务边界，不把原始 HTTP request 对象透传到下层。
   - 证据：`src/modules/orders/application/create-order.service.ts:12`
   - 问题说明：`CreateOrderService` 直接接收 Fastify `request` 对象并从中读取 body 与 headers，导致 application 与 transport 框架强耦合。
   - 改动建议：在 `src/modules/orders/application/commands/create-order.command.ts` 建立明确 command，由 `src/modules/orders/transport/orders.controller.ts` 负责把请求映射为 command。

2. `major`
   - 规则点：repository 只负责持久化和映射，不夹带跨聚合业务流程。
   - 证据：`src/modules/orders/infrastructure/persistence/postgres-order.repository.ts:48`
   - 问题说明：repository 在保存订单后直接调用支付网关预占额度，把外部集成流程藏进持久化层。
   - 改动建议：把支付预占逻辑移回 `src/modules/orders/application/create-order.service.ts`，repository 仅保留数据库访问与映射。

3. `minor`
   - 规则点：边界输入必须有运行时校验，不能只靠 TypeScript 类型。
   - 证据：`src/modules/orders/transport/orders.controller.ts:9`
   - 问题说明：当前只声明了 `CreateOrderBody` TypeScript 类型，没有实际 schema 解析。
   - 改动建议：在 `src/modules/orders/transport/schemas/create-order.request.ts` 增加 Zod schema，并在 controller 中先 parse 再下传。

## 检查清单

1. 是否先确认了业务能力、外部契约、模块边界、事务要求、持久化模型、并发要求和当前项目使用的 Node 基础设施？
   - 未阅读时标记 `NOT RUN`，不得伪装成已完成审查。
2. 当前目标分类是否明确为 `entrypoint`、`transport-module`、`application-module`、`domain-module`、`infrastructure-adapter`、`shared-support` 或 `mixed-module`？
   - 若分类不清，标记 `FAIL`，并说明职责为什么混杂。
3. transport 是否只处理路由、参数提取、输入校验和响应映射？
   - 若 transport 直接操作 repository、拼装事务或暴露持久化细节，标记 `FAIL`。
4. 边界输入与配置是否通过成熟 schema 方案或框架内建机制表达运行时契约？
   - 若只存在 TypeScript 类型、没有运行时校验，标记 `FAIL`，指出缺失位置和建议补点。
5. 依赖是否统一通过构造参数、工厂参数或模块装配显式注入，没有全局可变状态、隐式单例或横向读取容器？
   - 若不符合，标记 `FAIL`，指出具体模块和建议替换方式。
6. application service 是否承担用例编排与事务边界，而不是把这些职责分散在 transport、middleware、hook 或 repository 中？
   - 若不符合，标记 `FAIL`，指出错误边界和应迁移的位置。
7. domain 是否承载核心业务规则和仓储契约，而不是依赖 HTTP 框架、ORM、SDK 或消息中间件细节？
   - 若不符合，标记 `FAIL`，指出具体耦合点。
8. repository / gateway 是否只负责持久化和外部依赖访问，没有夹带 HTTP 拼装、鉴权决策、缓存编排或跨聚合流程？
   - 若不符合，标记 `FAIL`，指出越界逻辑和回收层次。
9. 数据库结构变更是否通过项目现有迁移机制表达？
   - 若缺失迁移脚本，标记 `FAIL` 或 `MISSING`，并说明原因。
10. 公共抽离是否按领域边界提升，而不是机械依据物理最近公共父级？
    - 出现 2 个明确独立使用点，或逻辑复杂到需要独立测试边界时即可拆分；全局基础设施可直接上浮，局部业务逻辑应留在当前 feature module 内。
    - 可配合 `verify-rules.mjs hoist` 做边界风险扫描；脚本 `PASS` 只代表扫描完成，`[HOIST_WARNING]` 必须人工复核，不代表实现整体通过。
11. 是否运行了与风险匹配的现有 lint、typecheck、test、build、启动验证或集成测试？
    - 缺少脚本或依赖时标记 `MISSING`，未执行标记 `NOT RUN`，失败标记 `FAIL`。
12. entrypoint 是否只负责框架初始化、插件挂载、全局中间件和顶层模块注册？
    - 若 entrypoint 逐个拼装具体 controller 路由，标记 `FAIL`，建议改由各 `transport-module` 暴露路由注册函数。
13. HTTP 安全基线是否完整覆盖 Helmet 或等价安全头、全局 Rate Limiting 和严格 CORS allowlist？
    - 若生产 API 全开放 CORS、缺少限流或未设置安全响应头，标记 `FAIL`，指出入口装配位置。
14. 日志是否为结构化 JSON，并在 logger 层配置密码、Token、支付凭证和核心 PII 的 Redaction？
    - 若使用 `console.log` 拼接业务日志，或日志明文输出敏感信息，标记 `FAIL`。
15. 模块系统是否统一为 ESM 或 CommonJS？
    - 若业务代码混用 `require` 与 `import`，或 TypeScript ESM 项目未使用 NodeNext 解析策略，标记 `FAIL`。
16. 测试边界是否匹配分层职责？
    - 若 domain/application 测试依赖真实 HTTP 或数据库，或 infrastructure 通过 Mock 数据库驱动伪造 repository 测试，标记 `FAIL`。

## 自校验脚本

- `node scripts/verify-rules.mjs`
- `node scripts/verify-rules.mjs hoist --target src/shared/order-formatters --uses src/modules/orders/create/create-order.service.ts src/modules/orders/update/update-order.service.ts src/modules/orders/cancel/cancel-order.service.ts`
