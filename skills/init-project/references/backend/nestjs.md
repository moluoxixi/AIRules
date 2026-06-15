---
ruleScope: nestjs
globs:
  - "**/*.ts"
description: 编写、重构或评审 NestJS 模块、控制器、provider、管道或守卫等后端代码时遵循
loadTiming: 写 NestJS 代码前
---
# NestJS 工程架构与代码规范

在执行任何 NestJS 后端代码生成、重构或评审任务时，必须严格遵守以下物理边界与编码红线。

## 一、输入防腐与安全边界

- 全局强制启用 `ValidationPipe` 并配置 `whitelist: true`、`forbidNonWhitelisted: true`、`transform: true`。
- DTO 禁止使用 `any`、`Record<string, any>` 或开放索引签名。
- 进入 Application/Domain 层后，禁止重复编写手动防御性代码。
- 列表查询 DTO 必须显式定义分页最大上限与排序字段白名单。
- Tenant-scoped 数据必须从服务端可信会话获取 `tenantId`，禁止信任客户端载荷。

## 二、核心架构与事务防腐

- Controller 仅处理路由与 DTO 映射，禁止编排业务或操作 ORM。
- Domain 必须保持纯粹，禁止依赖 HTTP 宿主对象、ORM 注解或技术细节。
- `EntityManager`、`QueryRunner` 等底层事务句柄只能存在于 Infrastructure 层。
- 禁止将远程网络调用或文件 I/O 隐式裹挟在数据库事务中。
- 同库事务使用 UnitOfWork；跨系统调用使用 Transactional Outbox 模式。

## 三、依赖注入与作用域安全

- 所有 Provider 依赖必须通过构造函数显式声明，禁止字段注入。
- 禁止在底层模块滥用 `Scope.REQUEST` 或注入 `REQUEST`。
- AsyncLocalStorage 必须封装为统一 `RequestContext`，禁止 Domain 直接读取。
- 视 `forwardRef()` 为设计缺陷，必须通过领域事件或解耦重构消除环形依赖。

## 四、序列化脱敏与错误映射

- 响应数据默认不暴露，必须通过 Response DTO 映射。
- 使用 `plainToInstance(..., { excludeExtraneousValues: true })` 时必须确保字段显式 `@Expose()`。
- 业务逻辑禁止直接读取 `process.env`，必须通过强类型 Config Provider 注入。
- 业务代码只抛出自定义领域/应用错误，并通过 `cause` 保留原始异常。
- HTTP 状态码转换统一交由全局 Exception Filter 处理。

## 五、强制测试交付要求

- 修改 Controller、DTO、Pipe、Guard、Interceptor、Filter、Provider、UseCase、Repository、事务边界或序列化映射时，必须同步交付有效测试代码。
- 测试目录优先沿用项目既有约定；缺少约定时，单元/模块测试放在目标代码同级 `__test__/`，跨模块 E2E 放在项目根级 `__e2e__/`。
- Domain、UseCase 和 Provider 必须交付单元测试，验证业务契约、依赖协作、异常分支和上下文传播。
- Controller、DTO ValidationPipe、Exception Filter、Guard 和序列化映射必须交付接口或模块级测试，显式断言状态码、响应 DTO、脱敏字段、校验失败和权限失败。
- 涉及 TypeORM/Prisma、UnitOfWork、Transactional Outbox、Repository 或数据库约束时，必须交付集成测试；优先使用 `@nestjs/testing`、项目既有测试数据库、Testcontainers 或等价隔离环境。
- 测试框架优先使用项目既有 Jest、Vitest、Supertest 或真实浏览器/E2E 工具；禁止只保留 `contextLoads`、模块能编译、能返回 200 等低价值烟雾测试。
