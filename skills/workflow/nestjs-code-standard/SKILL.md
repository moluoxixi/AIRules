---
name: nestjs-code-standard
description: 触发时机：当用户要求新建、编写、重构、拆分、优化、评审 NestJS 后端代码时触发。用于强制执行 DTO 契约、事务防腐层、序列化显式脱敏、依赖边界划分及 E2E 测试交付。
---

# NestJS 工程架构与代码规范 (NestJS Architecture & Code Standards)

在执行任何 NestJS 后端代码生成、重构或评审任务时，必须没有任何例外地严格遵守以下物理边界与编码红线。本文件是唯一规则源，绝不为了兼容历史写法而保留无价值的过渡层或破坏边界。

## 一、 输入防腐与安全边界 (Input & Security Boundaries)

- **强校验红线**：全局强制启用 `ValidationPipe` 并配置 `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`。彻底阻断未声明字段。
- **DTO 纯洁性**：严禁在 DTO 中使用 `any`、`Record<string, any>` 或开放索引签名。进入 Application/Domain 层后，禁止重复编写手动的防御性代码（如 `typeof` 或空值检查）。
- **查询边界**：列表查询 DTO 必须显式定义**分页最大上限**与**排序字段白名单**。绝对禁止将前端传入的任意 Query 对象直接透传给底层 ORM Builder。
- **租户隔离**：操作 Tenant-scoped 数据时，必须从服务端可信会话获取 `tenantId` 并强制作为 DB 查询边界，严禁信任客户端载荷。

## 二、 核心架构与事务防腐 (Architecture & Transaction Anti-Corruption)

- **分层死线**：
  - **Controller** 仅处理路由与 DTO 映射，严禁编排业务或操作 ORM。
  - **Domain** 必须保持纯粹，严禁依赖 HTTP 宿主对象、ORM 注解（仅允许 Domain Service 使用 `@Injectable()`）。
- **事务句柄隔离**：`EntityManager`、`QueryRunner` 等底层事务句柄只能存在于 Infrastructure 层。**绝对禁止**跨越至 Controller、Application 或 Domain。
- **长流程隔离**：严禁将远程网络调用或文件 I/O 隐式裹挟在数据库事务中。同库事务使用 UnitOfWork；跨系统调用必须使用 Transactional Outbox 模式。

## 三、 依赖注入与作用域安全 (DI & Scope Safety)

- **禁用字段注入**：所有 Provider 依赖必须通过构造函数显式声明。
- **禁用请求级作用域**：严禁在底层模块滥用 `Scope.REQUEST` 或注入 `REQUEST`。AsyncLocalStorage (ALS) 必须封装为统一的 `RequestContext`，且禁止 Domain 直接读取。
- **禁用环形依赖**：视 `forwardRef()` 为设计缺陷。强制通过领域事件或解耦重构消除环形依赖。

## 四、 序列化脱敏与错误映射 (Serialization & Error Mapping)

- **默认拒绝序列化**：响应数据默认不暴露。必须通过实例化 Response DTO 进行映射，或严格执行 `plainToInstance(..., { excludeExtraneousValues: true })` 确保未被 `@Expose()` 标记的字段被安全拦截。
- **环境变量控制**：业务逻辑严禁直接读取 `process.env`，必须通过强类型的 Config Provider 注入。
- **全局错误处理**：业务代码只抛出自定义领域/应用错误（必须通过 `cause` 保留原始异常）。HTTP 状态码转换统一交由全局 Exception Filter 处理。

## 五、 强制验证与交付动作 (Mandatory Deliverables)

代码修改完成后，必须同步交付相应的测试代码，并严格按以下模板输出报告：

1. **执行自检脚本**：尝试执行 `node scripts/verify-rules.mjs`。
2. **强制交付模板**：必须按照以下 Markdown 格式输出最终结论，禁止任何套话：

```markdown
### 代码合规自校验报告
- [ ] **输入防御**：所有 DTO 已去除 `any`，列表查询已配置上限与排序白名单。
- [ ] **依赖与容器**：未引入任何新的 `forwardRef()` 或 `Scope.REQUEST`。
- [ ] **事务防腐**：ORM 句柄未泄漏至 Infrastructure 外部，事务内无网络 I/O。
- [ ] **显式脱敏**：响应对象已通过 `excludeExtraneousValues: true` 或严格映射进行脱敏。
- [ ] **测试覆盖**：已同步交付包含 Negative Cases 的 E2E 测试或真实的 DB 集成测试。

### 脚本执行结果 (Status: PASS / FAIL / MISSING / NOT RUN)
- 脚本执行输出简述，或说明为何无法执行（MISSING）。

### 评审异常点 (仅在审查或重构失败时输出)
*(如无异常，填“无”)*
- **级别**：[Critical/Major/Minor]
- **文件与位置**：`xxx.ts:41`
- **违规说明**：... (如：在 Application 层直接注入了 EntityManager)
- **修复建议**：...
```
