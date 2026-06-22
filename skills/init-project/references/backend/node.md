---
ruleScope: node
globs:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.mjs"
description: 编写、重构或评审非 NestJS 的 Node.js 后端代码、Schema 边界、Express/Fastify 错误处理或运行时安全时遵循
loadTiming: 写 Node 后端代码前
---
# Node.js 后端工程代码规范

本规范是后端通用规范 `backend/code.md` 的 Node.js 叠加层，只列出 Node/TypeScript 运行时与 Express/Fastify 框架的特有约束。分层架构与防腐、契约边界、事务与错误传播、开发评审门槛、强制测试交付的通用红线见 `backend/code.md`，不在此重复；消费外部 API/SDK 见 `backend/api-consumer.md`，对外 API 契约见 `backend/out-api.md`。

在执行任何非 NestJS 的 Node.js 后端代码任务时，必须在 `backend/code.md` 的基础上叠加遵守以下特有红线。

## 一、Schema 与强类型安全（TypeScript）

- 外部输入输出边界必须使用 Schema 库如 Zod、TypeBox 进行运行时强校验。
- 禁止手写同名 Interface，静态类型必须由 Schema 推导。
- Domain Entity 和 UseCase Command 禁止复用 Transport 层 Schema 推导出的传输类型，必须是独立的纯业务语义类型。

## 二、事务上下文与框架错误处理

- 事务上下文必须通过 UnitOfWork 或 Node 原生 `AsyncLocalStorage` 隔离传递。
- Express 4 的 `async` Route Handler 必须使用 `asyncHandler` 包裹，避免未捕获的 Promise 拒绝逃逸。
- Fastify 必须注册 `setErrorHandler` 或统一 error plugin，禁止散落的局部错误兜底。

## 三、运行时性能与安全底线

- 禁止在主线程执行同步深拷贝、超大 JSON 序列化或容易引发 ReDoS 的高风险正则。
- Entrypoint 必须拦截 `SIGINT/SIGTERM`，停止接收新请求并安全销毁数据库/Redis 连接。
- Trace ID、Tenant ID 等横切关注点强制使用 Node 原生 `AsyncLocalStorage`，禁止侵入业务函数参数签名。

## 四、测试框架与目录约定

- 测试目录优先沿用项目既有约定；缺少约定时，单元测试放在目标代码同级 `__test__/`，跨模块 E2E 放在项目根级 `__e2e__/`。
- 测试框架优先使用项目既有 Vitest、Jest 或 Node Test Runner。
- HTTP Route、Schema、错误处理和鉴权上下文必须交付接口级测试，显式断言状态码、响应结构、校验失败和错误映射。
- Repository、UnitOfWork、事务、数据库约束或外部 SDK 适配器必须交付集成测试；优先使用项目既有测试数据库、Testcontainers 或等价隔离环境。
