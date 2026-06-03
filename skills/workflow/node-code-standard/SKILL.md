---
name: node-code-standard
description: 触发时机：当用户要求新建、编写、重构、拆分、优化、评审非 NestJS 的 Node.js/TypeScript 后端代码时触发。用于强制执行分层边界、Schema 强校验、隔离底层事务句柄、Express/Fastify 错误处理及强制测试验证。
---

# Node.js 后端工程架构与代码规范 (Node.js Architecture & Code Standards)

在执行任何非 NestJS 的 Node.js 后端代码生成、重构或评审任务时，必须没有任何例外地严格遵守以下物理边界与编码红线。

## 一、分层架构与防腐红线 (Layered Architecture & Boundaries)

- **依赖倒置**：`Domain` 承载核心规则，绝对禁止依赖 HTTP 框架、ORM、SDK 或第三方工具。`Infrastructure` 负责封装数据库和 SDK，禁止反向污染业务类型的定义。
- **职责死线**：
  - **Transport 层 (Router/Controller)**：仅处理参数提取、输入校验与协议映射。严禁在此直接编写业务逻辑或操作数据库。
  - **Application 层 (UseCase)**：负责编排业务流程与界定事务边界。严禁透传 HTTP 框架原生对象（如 `req`, `res`, `reply`）至此层。
- **禁止垃圾桶**：业务 Helper 必须就近留在 Feature 模块内。全局 `shared/utils` 仅限纯技术工具，严禁存放带有业务语义的代码。

## 二、契约边界与强类型安全 (Contracts & Type Safety)

- **Schema 唯一真实源 (SSOT)**：所有外部输入输出边界（HTTP、RPC、Event）必须使用 Schema 库（如 Zod, TypeBox）进行运行时强校验。严禁手写同名 Interface，静态类型必须由 Schema 推导（如 `z.infer`）。
- **校验边界隔离**：Schema 校验仅用于 Transport 边界。进入 Application/Domain 后，禁止重复编写防御性代码（如 `typeof`、空值检查、正则校验）。
- **领域纯粹性**：Domain Entity 和 UseCase Command 的类型必须是纯业务语义的，禁止直接复用或被迫继承自 Transport 层的 Schema 推导类型。

## 三、事务与错误传播 (Transactions & Error Handling)

- **事务防腐**：绝对禁止将 `Knex.Transaction`、`Prisma.TransactionClient`、`EntityManager` 等底层数据库句柄透传给 Domain 或 Application 层。必须通过 UnitOfWork 或 AsyncLocalStorage 进行上下文隔离。
- **长事务隔离**：禁止将远程 RPC 调用或耗时外部 I/O 裹挟在数据库同步事务中，必须采用 Outbox 模式或异步补偿机制。
- **框架级错误传播**：
  - **Express 4 降级防线**：所有 `async` Route Handler 强制使用 `asyncHandler` 包裹，防止 Promise Rejection 导致进程静默或请求挂起。
  - **Fastify 全局收口**：必须注册 `setErrorHandler` 或统一 error plugin。Route 内部不得 catch 后返回伪装的 200/成功状态。
  - **全局收口**：必须在框架顶级（Global Error Middleware / `setErrorHandler`）统一处理业务抛出的明确错误，严禁在 Route 内部吞错或直接返回伪装的 200/成功状态。

## 四、运行时性能与安全底线 (Runtime & Security)

- **Event Loop 保护**：严禁在主线程执行同步深拷贝、超大 JSON 序列化或容易引发 ReDoS 的高风险正则。
- **Graceful Shutdown**：Entrypoint 必须拦截 `SIGINT/SIGTERM` 信号，停止接收新请求并安全销毁数据库/Redis 连接，严禁直接进程退出。
- **ALS 传递**：传递 Trace ID、Tenant ID 等横切关注点时，强制使用 Node 原生的 `AsyncLocalStorage`，禁止侵入业务函数的参数签名。

## 五、强制验证与交付动作 (Mandatory Deliverables)

任务完成后，必须自动执行以下操作，并严格按模板输出报告：

1. **执行自校验**：必须尝试在终端执行 `lint`、`typecheck` 或相关自动化测试。
2. **强制交付模板**：必须按照以下 Markdown 格式输出最终结论，禁止任何套话或角色扮演：

```markdown
### 代码合规自校验报告
- [ ] **依赖与防腐**：Application/Domain 未直接引入 req/res 对象或 ORM 事务句柄。
- [ ] **强类型契约**：外部输入已通过 Schema (Zod/TypeBox) 校验，无手写重复 Interface。
- [ ] **错误与生命周期**：Async 路由的 Rejection 已被接管，Entrypoint 已配置优雅退出。
- [ ] **测试覆盖**：已同步交付对应的集成或单元测试代码。

### 执行结果 (Status: PASS / FAIL / MISSING / NOT RUN)
- 脚本执行输出简述，或说明为何无法执行（MISSING）。

### 评审异常点 (仅在审查或重构失败时输出)
*(如无异常，填“无”)*
- **级别**：[Critical/Major/Minor]
- **文件与位置**：`xxx.ts:41`
- **违规说明**：... (如：在 Controller 层直接调起了 Prisma Transaction)
- **修复建议**：...
```
