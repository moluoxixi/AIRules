---
ruleScope: node
globs:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.mjs"
description: 编写、重构或评审非 NestJS 的 Node.js 后端代码、分层架构或防腐边界时遵循
loadTiming: 写 Node 后端代码前
---
# Node.js 后端工程架构与代码规范

在执行任何非 NestJS 的 Node.js 后端代码生成、重构或评审任务时，必须严格遵守以下物理边界与编码红线。

## 一、分层架构与防腐红线

- `Domain` 承载核心规则，禁止依赖 HTTP 框架、ORM、SDK 或第三方工具。
- `Infrastructure` 负责封装数据库和 SDK，禁止反向污染业务类型定义。
- `Transport` 层仅处理参数提取、输入校验与协议映射，禁止直接编写业务逻辑或操作数据库。
- `Application` 层负责编排业务流程与界定事务边界，禁止透传 `req`、`res`、`reply` 等框架对象。
- 业务 Helper 必须就近留在 Feature 模块内；全局 `shared/utils` 仅限纯技术工具。

## 二、契约边界与强类型安全

- 外部输入输出边界必须使用 Schema 库如 Zod、TypeBox 进行运行时强校验。
- 禁止手写同名 Interface，静态类型必须由 Schema 推导。
- Schema 校验仅用于 Transport 边界；进入 Application/Domain 后，禁止重复编写防御性代码。
- Domain Entity 和 UseCase Command 必须是纯业务语义类型，禁止复用 Transport 层 Schema 推导类型。

## 三、事务与错误传播

- 禁止将 `Knex.Transaction`、`Prisma.TransactionClient`、`EntityManager` 等底层数据库句柄透传给 Domain 或 Application。
- 事务必须通过 UnitOfWork 或 AsyncLocalStorage 隔离上下文。
- 禁止将远程 RPC 调用或耗时外部 I/O 裹挟在数据库同步事务中。
- Express 4 的 `async` Route Handler 必须使用 `asyncHandler` 包裹。
- Fastify 必须注册 `setErrorHandler` 或统一 error plugin。
- Route 内部不得 catch 后返回伪装的 200/成功状态。

## 四、运行时性能与安全底线

- 禁止在主线程执行同步深拷贝、超大 JSON 序列化或容易引发 ReDoS 的高风险正则。
- Entrypoint 必须拦截 `SIGINT/SIGTERM`，停止接收新请求并安全销毁数据库/Redis 连接。
- Trace ID、Tenant ID 等横切关注点强制使用 Node 原生 `AsyncLocalStorage`，禁止侵入业务函数参数签名。

## 五、强制测试交付要求

- 修改 Transport、Application、Domain、Infrastructure、Schema、错误映射、事务边界或可复用工具逻辑时，必须同步交付有效测试代码。
- 测试目录优先沿用项目既有约定；缺少约定时，单元测试放在目标代码同级 `__test__/`，跨模块 E2E 放在项目根级 `__e2e__/`。
- Domain、UseCase、纯工具函数必须优先交付单元测试，验证业务契约、边界条件和异常路径。
- HTTP Route、Schema、错误处理和鉴权上下文必须交付接口级测试，显式断言状态码、响应结构、校验失败和错误映射。
- Repository、UnitOfWork、事务、数据库约束或外部 SDK 适配器必须交付集成测试；优先使用项目既有测试数据库、Testcontainers 或等价隔离环境。
- 测试框架优先使用项目既有 Vitest、Jest 或 Node Test Runner；不得为了测试绕过真实契约、删除断言或只验证“能启动/能返回 200”。
