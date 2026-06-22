---
ruleScope: nestjs
globs:
  - "**/*.ts"
description: 编写、重构或评审 NestJS 模块、控制器、provider、管道、守卫、拦截器或异常过滤器时遵循
loadTiming: 写 NestJS 代码前
---
# NestJS 工程代码规范

本规范是后端通用规范 `backend/code.md` 的 NestJS 叠加层，只列出 NestJS 框架的特有约束。分层架构与防腐、契约边界、事务与错误传播、开发评审门槛、强制测试交付的通用红线见 `backend/code.md`，不在此重复；消费外部 API/SDK 见 `backend/api-consumer.md`，对外 API 契约见 `backend/out-api.md`。

在执行任何 NestJS 后端代码任务时，必须在 `backend/code.md` 的基础上叠加遵守以下特有红线。

## 一、ValidationPipe 与输入防腐

- 全局强制启用 `ValidationPipe` 并配置 `whitelist: true`、`forbidNonWhitelisted: true`、`transform: true`。
- DTO 禁止使用 `any`、`Record<string, any>` 或开放索引签名。
- 列表查询 DTO 必须显式定义分页最大上限与排序字段白名单。

## 二、依赖注入与作用域安全

- 所有 Provider 依赖必须通过构造函数显式声明，禁止字段注入。
- 禁止在底层模块滥用 `Scope.REQUEST` 或注入 `REQUEST`。
- AsyncLocalStorage 必须封装为统一 `RequestContext`，禁止 Domain 直接读取请求上下文。
- 视 `forwardRef()` 为设计缺陷，必须通过领域事件或解耦重构消除环形依赖。

## 三、事务句柄与编排边界

- Controller 仅处理路由与 DTO 映射，禁止编排业务或操作 ORM。
- `EntityManager`、`QueryRunner` 等底层事务句柄只能存在于 Infrastructure 层。
- 同库事务使用 UnitOfWork；跨系统调用使用 Transactional Outbox 模式。

## 四、序列化脱敏与错误映射

- 响应数据默认不暴露，必须通过 Response DTO 映射。
- 使用 `plainToInstance(..., { excludeExtraneousValues: true })` 时必须确保字段显式 `@Expose()`。
- 业务逻辑禁止直接读取 `process.env`，必须通过强类型 Config Provider 注入。
- 业务代码只抛出自定义领域/应用错误，并通过 `cause` 保留原始异常；HTTP 状态码转换统一交由全局 Exception Filter 处理。

## 五、测试框架与目录约定

- 测试目录优先沿用项目既有约定；缺少约定时，单元/模块测试放在目标代码同级 `__test__/`，跨模块 E2E 放在项目根级 `__e2e__/`。
- 测试框架优先使用项目既有 Jest、Vitest、Supertest 或真实 E2E 工具。
- Controller、DTO ValidationPipe、Exception Filter、Guard 和序列化映射必须交付接口或模块级测试，显式断言状态码、响应 DTO、脱敏字段、校验失败和权限失败。
- 涉及 TypeORM/Prisma、UnitOfWork、Transactional Outbox、Repository 或数据库约束时，必须交付集成测试；优先使用 `@nestjs/testing`、项目既有测试数据库、Testcontainers 或等价隔离环境。
