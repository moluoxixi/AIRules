---
name: node-code-standard
description: 用于新写或重构 Node.js/TypeScript/JavaScript 后端代码时，按后端最佳实践重建模块、契约、校验、事务、持久化边界和集成方式；默认不依赖仓库中的其它 project skills。
---

# Node 后端实现标准

## 用途

本 Skill 用于新写或重构 Node.js 后端代码，覆盖 TypeScript 与 JavaScript 项目，适用于基于 Express、Fastify、Nest 以外的轻量自建分层、HTTP API、任务处理、事件消费和数据访问代码。

本文件是 Node 后端实现标准的唯一规则源。不要跳转到仓库中的其它 project skills 作为实现依据；只有当前项目真实代码、当前任务约束和本 Skill 内规则生效。

## 使用场景

当任务目标是新增接口、重构模块、收敛 service 职责、补齐输入校验、调整事务边界、整理 repository 越界逻辑、统一错误映射，或规范 Node 后端目录与分层时，使用本 Skill。

本 Skill 面向新实现和重构实现，不面向兼容式修补。旧目录结构、旧 DTO、旧 service、旧 repository、旧事务边界、旧错误映射或旧集成层妨碍当前目标时，直接按标准重建；不要为了兼容历史写法保留冗余 facade、双 service、过渡 mapper、伪分层或空壳目录。

## 工作顺序

1. 先确认业务能力、外部契约、模块边界、事务要求、持久化模型、并发要求和当前项目使用的 Node 基础设施。
2. 判断代码应留在当前 feature module 内，还是满足真实复用后再抽到最近公共父级。
3. 优先复用项目已有成熟库和框架能力，例如 HTTP 框架、schema 校验库、ORM、SQL builder、迁移工具、日志库和测试工具。
4. 直接按目标职责重建 route、schema、application、domain、infrastructure 和装配关系，不保留无价值兼容层。
5. 完成后按风险执行项目已有 lint、typecheck、test、build、启动验证、集成测试或契约验证；缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

## 实现原则

- 契约优先：HTTP 输入输出、command、query、event、配置和仓储接口必须表达真实边界，不用 `any`、宽泛对象、裸 JSON 或可选字段堆砌掩盖契约。
- 失败显性：依赖、配置、输入、状态或外部调用结果不满足契约时暴露失败，不写吞错、伪成功、空对象回退、静默兼容或无依据默认值。
- 边界清晰：transport 只处理协议层；application 负责用例编排和事务边界；domain 承载业务规则；infrastructure 封装数据库、消息和第三方调用。
- 校验前置：边界输入优先通过 schema 校验库或框架校验机制表达运行时契约；不要只靠 TypeScript 类型假设运行时输入可靠。
- 依赖显式：统一通过构造参数、工厂函数参数或模块装配显式注入依赖，不写隐式单例、全局可变状态或横向读取容器。
- 异步可追踪：所有 I/O、任务和事件处理都要明确成功、失败和超时语义，不丢失 Promise、不吞掉 rejection、不写后台悬空任务。
- 事务收敛：事务只放在真正的应用用例边界；除非项目已有明确模式支撑，否则不要把远程调用和数据库事务混成隐式大事务。
- 持久化封装：repository 和 gateway 只负责持久化或外部依赖访问，不承担 HTTP 拼装、鉴权决策、缓存编排或跨聚合业务流程。
- 共享逐级上浮：公共代码只有满足至少三个独立使用点时才抽离，并且落在最近公共父级的直接共享目录。
- 抽象要付账：不要为了“更像后端架构”机械增加 facade、manager、handler、assembler、util、wrapper 或空 module。
- 注释解释意图：注释只说明事务边界、领域约束、并发保证、外部契约和非显然取舍，不复述代码流程。

## 目标分类

- `entrypoint`：服务启动、环境配置加载、全局中间件、错误处理注册、路由装配和进程生命周期管理。
- `transport-module`：HTTP route、controller、request/response schema、认证上下文读取和协议适配。
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
- application service 接收 command / query 或明确 DTO，不把原始 HTTP request 对象透传到 domain 或 infrastructure。
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
- DTO、领域对象、持久化模型分离；除非项目已明确接受耦合，否则不要直接把 ORM model 或数据库行对象暴露给 API。
- 数据库结构变更必须通过项目现有迁移机制表达，例如 Prisma Migrate、Drizzle Kit、Knex migration、TypeORM migration 或 Sequelize migration；不得手工假设线上表结构。
- 日志必须保留请求上下文、错误上下文和关键业务标识；不要记录伪成功，也不要用日志替代错误处理。
- 并发控制、幂等和重试必须在明确边界内设计；不要靠重复查询、静默覆盖或“多试几次”掩盖竞态。
- 队列、定时任务和事件消费者也必须遵守相同分层：handler 负责协议入口，application 负责编排，infrastructure 负责外部系统适配。

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
- repository、gateway 和外部依赖是否只承担持久化/集成职责，没有越界承载业务编排。
- 共享抽离是否满足至少三个独立使用点，并且位于最近公共父级的直接共享目录。
- 是否运行了与风险匹配的现有 lint、typecheck、test、build、启动验证或集成测试。

## 辅助资源

- 示例：`examples/node-backend-structure.md`
- 评审示例：`examples/review-output.md`
- 校验清单：`validation/checklist.md`
- 自校验脚本：`scripts/verify-rules.mjs`
