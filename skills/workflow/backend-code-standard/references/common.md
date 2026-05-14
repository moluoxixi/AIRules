# 后端通用代码规范

## 分层边界

常见后端分层：
- route/controller：传输边界、请求校验、响应整形；
- application/service：用例编排和业务规则；
- domain/model：领域不变量和纯规则，适用于有领域层的项目；
- repository/DAO/mapper：持久化访问；
- infrastructure/client：外部服务、队列、缓存、对象存储和 SDK 适配器；
- configuration：环境解析和运行时选项。

在架构支持时，依赖方向应尽量向内。避免 service 导入 controller，也避免 DTO 导入 repository。

## 命名

优先使用项目约定。默认参考：
- API handlers/controllers：名词或资源名 + 传输层后缀，例如 `OrderController`。
- services/use cases：业务能力，例如 `OrderApprovalService`。
- repositories/DAOs：聚合或表名 + 持久化后缀，例如 `OrderRepository`。
- DTOs：操作和方向，例如 `CreateOrderRequest`, `OrderDetailResponse`。
- errors/exceptions：领域原因，例如 `OrderNotFoundError`。

## DTO、Entity 与视图边界

- Request DTO 描述可接受输入，不代表数据库行。
- Response DTO 描述公开输出，不代表内部 entity。
- Entity 或持久化模型描述存储状态和不变量。
- 除非 API 契约要求，不暴露仅持久化使用的字段。
- 除非明确设计，不接收客户端控制服务端拥有的字段，例如 id、tenant id、audit fields、roles 或状态流转字段。

## 错误语义

错误应保持可见：
- validation errors 应指出无效字段或业务约束；
- domain errors 应映射到显式失败响应；
- infrastructure errors 应保留足够 cause context 以便诊断；
- catch block 可补充上下文或清理资源，然后重新抛出或返回等价失败结果。

写入失败、鉴权失败、外部调用失败或事务失败后，不应返回带空数据的成功响应。

## 事务

当多个写入或 read-modify-write 操作必须保持原子性时使用事务。除非框架已有明确模式，事务边界优先放在 service/use-case 代码中。

除非项目明确接受风险，不要在事务内执行耗时外部调用。

## 日志与配置

必需配置缺失或格式错误时应 fail fast。不要静默默认生产关键 URL、凭据、功能开关或安全选项。

日志可包含 request id 或 correlation id，但必须脱敏 secrets 和用户敏感数据。
