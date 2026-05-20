---
name: nestjs-backend-standard
description: 用于新写、重构或评审 NestJS 后端代码时，按统一 NestJS 最佳实践重建模块、契约、校验、事务、持久化边界和评审输出；默认不依赖仓库中的其它 project skills。
---

# NestJS 后端实现标准

## 用途

本 Skill 用于新写、重构或评审 NestJS 后端代码，覆盖模块设计、控制器契约、DTO 校验、应用编排、领域边界、持久化封装、事务控制和评审输出。

本文件是 NestJS 后端实现与评审的唯一规则源。不要跳转到仓库中的其它 project skills 作为实现依据；只有当前项目真实代码、当前任务约束和本 Skill 内规则生效。

## 使用场景

当任务目标是新增接口、重构模块、收敛服务职责、补齐 DTO 校验、调整事务边界、清理 repository 越界逻辑，或评审现有 NestJS 代码是否符合后端最佳实践时，使用本 Skill。

本 Skill 面向新实现和重构实现，不面向兼容式修补。旧模块结构、旧 DTO、旧 provider 组织、旧事务边界或旧错误映射妨碍当前目标时，直接按标准重建；不要为了兼容历史写法保留冗余 facade、双 service、过渡 mapper 或伪分层。

## 工作顺序

1. 先确认业务能力、外部契约、模块边界、事务要求、持久化模型和当前项目使用的 Nest 基础设施。
2. 判断代码应留在当前 feature module 内，还是满足真实复用后再抽到最近公共父级。
3. 优先复用项目已有成熟库和框架能力，例如 NestJS、`ValidationPipe`、`class-validator`、`class-transformer`、ORM、事务工具和测试工具。
4. 直接按目标职责重建 controller、DTO、application、domain、infrastructure 和 provider 关系，不保留无价值兼容层。
5. 完成后按风险执行项目已有 lint、test、build、启动验证或集成测试；缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

## 实现原则

- 契约优先：HTTP 输入输出、command、query、事件和配置类型必须表达真实边界，不用 `any`、宽泛对象、裸 JSON 或可选字段堆砌掩盖契约。
- 失败显性：依赖、配置、输入或状态不满足契约时暴露失败，不写吞错、伪成功、空对象回退或无依据默认值。
- 构造函数注入：统一使用构造函数注入 provider，不写字段注入、隐式单例状态或横向读取容器。
- 校验前置：边界输入优先在 DTO 上通过 `class-validator` 表达，并配合 `ValidationPipe` 统一收口；领域不变量留在领域模型或 use case 中表达。
- 边界清晰：controller 只处理传输层；application 负责用例编排和事务边界；domain 承载业务规则；infrastructure 封装数据库、消息和第三方调用。
- 事务收敛：事务只放在真正的应用用例边界；除非项目已有明确模式支撑，否则不要把远程调用和数据库事务混成一个隐式大事务。
- 持久化封装：repository 和 adapter 只负责持久化或外部依赖访问，不承担 HTTP 拼装、响应整形、鉴权决策或跨聚合流程。
- 共享逐级上浮：公共代码只有满足至少三个独立使用点时才抽离，并且落在最近公共父级的直接共享目录。
- 抽象要付账：不要为了“更像 Nest 项目”机械增加 facade、manager、assembler、util、wrapper 或空 module。
- 注释解释意图：注释只说明事务边界、领域约束、模块协作和非显然取舍，不复述代码流程。

## 目标分类

- `entrypoint`：`main.ts`、全局 `ValidationPipe`、全局 filter、全局 interceptor、应用启动与装配。
- `application-module`：以某个业务能力为中心的 Nest feature module，内部区分用例编排与依赖装配。
- `domain-module`：聚合、值对象、领域服务、领域错误和仓储契约。
- `infrastructure-adapter`：数据库仓储实现、外部 API client、消息实现、缓存、文件存储等。
- `shared-support`：满足真实复用后上浮的共享契约、工具、装饰器或模块支持代码。
- `mixed-module`：当前目录同时混入多层职责，通常意味着需要收敛边界并重构。

## NestJS 分层与职责边界

### controller

- 处理路由、参数提取、认证上下文读取、DTO 入参校验和响应映射。
- controller 不直接编排跨仓储流程，不直接写事务，不直接操作 ORM entity。
- request / response DTO 只表达传输契约，不承载持久化注解或领域行为。

### application

- 承载 use case 编排、事务边界、权限决策协调和跨仓储流程。
- application service 接收 command / query 或明确 DTO，不把 controller request 原样透传到 domain 或 infrastructure。
- application service 返回领域结果或稳定响应模型，不返回 `Response`、`Request` 或其它 HTTP 宿主细节。

### domain

- 承载聚合、值对象、领域服务、领域规则、领域事件和仓储接口。
- 领域规则优先放在聚合、值对象或领域服务中，不要散落在 controller、pipe 或 repository 实现里。
- domain 不依赖 Nest 装饰器、Web 宿主对象或 ORM 细节；必要时通过接口反转依赖。

### infrastructure

- 放置 ORM entity、repository 实现、第三方客户端、消息发布实现、缓存适配器和配置适配。
- infrastructure 依赖 domain / application 契约实现，不反向让上层依赖 ORM、SDK 或传输细节。

## NestJS 专项约束

- `ValidationPipe` 应作为统一输入校验入口；参数、body、query、param 的 DTO 校验必须可追踪。
- DTO 使用 `class` 与 `class-validator` 表达契约，不用 interface 冒充运行时校验对象。
- provider 依赖通过构造函数声明，不用从模块外部隐式读取实例。
- `@Module` 只暴露稳定 provider 和 controller；不要把内部实现无边界 export 给外层模块。
- exception filter、interceptor、guard、pipe 要按职责拆分，不把业务规则塞进基础设施横切层。
- repository 返回值、错误和幂等语义必须清晰；不要把 ORM 特有异常直接裸抛到 controller。
- 需要数据库变更时，必须通过项目现有迁移机制表达；不得手工假设线上表结构。

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

- 目标分类只能使用 `entrypoint`、`application-module`、`domain-module`、`infrastructure-adapter`、`shared-support` 或 `mixed-module`。
- 检查范围必须说明实际阅读的文件、目录、调用链或验证命令；未检查部分标记 `NOT RUN`。
- 总结论只能使用 `PASS`、`FAIL`、`MISSING`、`NOT RUN` 或 `N/A`。
- 不得把脚本 `PASS`、未检查项或缺少脚本写成整体 `PASS`。
- 不得只写“建议优化”“建议调整”“建议规范化”这类空泛建议。

## 完成前检查

- 模块边界是否围绕当前业务能力，而不是继续迁就旧结构。
- controller、application、domain、infrastructure 的职责是否混淆。
- DTO、`ValidationPipe`、构造函数注入、事务边界和错误映射是否表达清楚。
- repository、adapter 和外部依赖是否只承担持久化/集成职责，没有越界承载业务编排。
- 共享抽离是否满足至少三个独立使用点，并且位于最近公共父级的直接共享目录。
- 是否运行了与风险匹配的现有 lint、test、build、启动验证或集成测试。

## 辅助资源

- 示例：`examples/nestjs-backend-structure.md`
- 评审示例：`examples/review-output.md`
- 校验清单：`validation/checklist.md`
- 自校验脚本：`scripts/verify-rules.mjs`
