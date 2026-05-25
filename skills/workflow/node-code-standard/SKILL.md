---
name: node-code-standard
description: 用于新建、编写、重构、拆分、优化、评审或校验非 NestJS 的 Node.js/TypeScript/JavaScript 后端代码，覆盖模块边界、契约校验、事务、持久化、错误映射和集成边界。
---

# Node 后端架构与实现准则 (Core Standards)

## 1. 核心定位

本准则用于规范非 NestJS 的 Node.js 后端代码（TypeScript/JavaScript），覆盖新建、重构与 Review 场景。

**执行原则：** 面向目标重建，拒绝为了兼容历史遗留（冗余 Facade、伪分层、旧错误映射）而妥协。

本文件是 Node 后端实现标准的唯一规则源。不要跳转到仓库中的其它 project skills 作为实现依据；只有当前项目真实代码、当前任务约束和本 Skill 内规则生效。

## 2. 模块与架构边界

采用 Feature-First 目录组织，严格执行依赖倒置（Dependency Inversion），静态依赖方向必须始终指向内层：`Transport -> Application -> Domain`。

- **依赖反转与装配：** `Infrastructure` 绝对不能被 `Domain` 依赖。`Infrastructure` 通过实现 `Application` 或 `Domain` 层定义的接口（Port/Adapter），最终在 Composition Root（装配入口）完成依赖注入。
- **单一职责与文件拆分：** 严禁文件承担过多职责。当 Service、Controller 或 Domain 逻辑过载时，必须按领域行为或独立可测试边界进行拆分。
- **Utility 收敛防腐：** 纯技术工具（如加密、时间处理）可放入全局 `shared/utils`，但业务 Helper 默认必须留在 Feature 模块内部。跨域业务能力应按领域命名上浮，严格禁止将 `shared/utils` 作为泛化的“业务逻辑垃圾桶”。
- **Transport（契约层）：** 仅处理路由、参数提取、输入校验与协议状态。只负责让错误进入统一 Error Boundary，错误映射由全局 Error Middleware / `setErrorHandler` 完成。禁止在此层编排跨域流程或直接操作仓储。
- **Application（编排层）：** 负责 UseCase 编排与事务边界。接收 Command/Query，返回领域结果。禁止透传 HTTP 框架原生对象（`req` / `res` / `reply`）。
- **Domain（领域层）：** 承载聚合、值对象与核心规则。与基础设施完全解耦。
- **Infrastructure（基建层）：** 封装 ORM、第三方 SDK 与底层事务。禁止反向污染上层。

## 3. 契约与输入输出边界 (Contract Boundaries)

- **SSOT（Single Source of Truth）：** 外部输入输出边界（HTTP、RPC、Event、Job、Config 等 Contract Boundary）必须由 Schema（如 Zod、TypeBox）保证运行时强校验。此边界内的 TypeScript 静态类型必须由 Schema 推导（如 `z.infer`），绝对禁止手写同名 Interface 造成双写漂移。
- **业务语义解绑：** Domain 层的 Entity、Value Object 以及 Application 层的 UseCase Command 必须是纯粹的业务语义类型，不应强制从 Transport Schema 推导，避免业务层被底层校验框架绑架。
- **失败显性化：** 契约不符时必须抛出明确错误，严禁吞错、空对象回退或返回伪成功状态。

## 4. 事务与持久化隔离 (Transaction & Persistence)

- **UseCase 级事务封装：** 事务边界必须收敛在 Application 层。
- **禁止事务句柄泄漏：** 严禁将底层事务对象（如 `Knex.Transaction`、`Prisma.TransactionClient`、`EntityManager`）作为参数透传给 Domain 或 Application 层。必须通过 `UnitOfWork` 模式或基于 `AsyncLocalStorage` 的上下文进行封装隔离。
- **禁用长事务：** 涉及高风险/高耗时的外部副作用（如远程调用、支付预占）时，禁止与数据库同步大事务混编，强制采用 Outbox Pattern 或异步补偿机制。

## 5. 异步控制与错误边界 (Async & Error Propagation)

- **全局错误收口：** 必须在框架顶级统一映射错误码与响应体。
- **异步错误可达（Async Error Propagation）：**
  - **Express 4：** 严禁挂载裸 `async` Route Handler，必须包裹 `asyncHandler` 确保 Promise Rejection 被转发到全局 Error Middleware。
  - **Express 5：** 原生支持 Promise Rejection 转发，但必须进行版本确认，并通过协议级集成测试（如 Supertest）验证错误拦截，禁止机械添加冗余 Wrapper。
- **防事件循环阻塞（Event Loop Unblocking）：** 严禁在主线程执行同步深拷贝、超大 JSON 序列化或高风险正则（ReDoS）。必须采用 Stream、Backpressure 或 Offloading（Worker Threads / `worker_threads` / 后台任务）。
- **Crash 语义与优雅退出（Graceful Shutdown）：** 业务错误必须在请求/任务级 Error Boundary 内处理。进程级 Crash Handler 仅作为最后防线，用于处理逃逸的不可恢复错误（`uncaughtException` / `unhandledRejection`），此时必须记录日志并主动退出进程。Entrypoint 必须拦截 `SIGINT/SIGTERM`，停止接收新请求并安全释放所有连接。

## 6. 可观测性与安全基线

- **安全入口防护：** Entrypoint 强制配置 Helmet（安全头）、全局限流（Rate Limiting）与严格的 CORS 白名单。
- **结构化日志与脱敏：** 强制使用 Pino/Winston 输出 JSON 日志。严禁使用 `console.log`，必须在 Logger 层配置 PII（如密码、Token、证件号）的自动 Redaction（脱敏）。
- **ALS 追踪：** 跨异步边界传递请求上下文（Trace ID、Tenant ID）必须使用 Node 原生 `AsyncLocalStorage`，禁止侵入式修改业务函数签名。

## 7. AI / 代码评审执行指令 (Review Protocol)

当执行代码 Review 任务时，必须严格比对上述 1-6 条准则。直接输出以下结构，禁止输出无关的客套话或泛泛而谈的优化建议：

**【评审结论】** 根据以下定义输出状态：

- `PASS`：已检查范围内未发现违反准则的问题。
- `FAIL`：验证命令执行失败，或发现明确违反本准则的代码问题。
- `MISSING`：缺少必要的脚本、依赖、配置或测试入口。
- `NOT RUN`：存在验证入口但未实际执行检查，必须说明原因。

**【检查范围】** [列出实际检查的文件、目录、调用链或验证命令]

**【问题清单】**（如无问题则省略）

- **[Critical / Major / Minor]** `规则点名称`
  - **位置：** 文件路径及行号
  - **说明：** 明确指出违反了哪条具体约束（例如 Schema 双写漂移、泄漏事务句柄、主线程阻塞风险）。
  - **行动项：** 给出可直接执行的代码修改建议或重构落点。

## 8. 自校验脚本

- `node scripts/verify-rules.mjs`
- `node scripts/verify-rules.mjs hoist --target src/shared/order-formatters --uses src/modules/orders/create/create-order.service.ts src/modules/orders/update/update-order.service.ts src/modules/orders/cancel/cancel-order.service.ts`

`verify-rules.mjs hoist` 的 `[HOIST_WARNING]` 只表示共享边界存在机械风险信号，必须人工结合领域语义复核，不能把扫描 `PASS` 当作实现整体通过。
