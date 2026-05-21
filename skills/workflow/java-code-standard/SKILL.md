---
name: java-code-standard
description: 用于新写或重构 Java / Spring Boot 后端代码时，按统一后端标准重建 package、分层职责、依赖注入、校验、事务、迁移和错误映射；默认不参考仓库中其它 project skills 的实现规则。
---

# Java 后端实现标准

## 用途

本 Skill 用于新写或重构 Java 与 Spring Boot 后端代码，覆盖 Java 17+ 基线、Java 21/25 LTS、Maven 和 Gradle 项目。

本文件是 Java 后端实现标准的唯一规则源。不要再跳转到旧的主规范文档，也不得依赖仓库中的其它 project skills 作为实现依据；只有当前项目真实代码、当前任务约束和本 Skill 内规则生效。

## 使用场景

当任务目标是新写接口、重构领域逻辑、整理 package 边界、规范事务和持久化职责、补齐请求校验或统一异常映射时，使用本 Skill。

本 Skill 面向新实现和重构实现，不面向兼容式修补。旧 package 结构、旧 DTO、旧注入方式、旧事务边界或旧错误映射一旦妨碍当前目标，就直接按标准重建；不要为了兼容历史写法保留冗余 service、双 DTO、过渡 mapper 或伪分层。

## 工作顺序

1. 先确认业务能力、外部契约、数据边界、事务要求、持久化模型和项目当前使用的 Spring Boot 基础设施。
2. 判断代码应该留在 feature package 内，还是满足真实复用后再抽到最近公共父级 package。
3. 优先复用项目已有成熟库和框架能力，例如 Spring Boot、Spring MVC、Spring Data、Bean Validation、Flyway、Liquibase、MapStruct、Jackson、Testcontainers。
4. 直接按目标职责重建 package、分层职责、依赖注入、请求校验、事务边界和错误映射，不保留无价值兼容层。
5. 完成后按风险执行项目已有 format、lint、test、build、集成测试或启动验证；缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

## 实现原则

- 契约优先：Controller、request、response、command、query 和事件类型必须表达真实边界，不用宽泛 Map、裸 JSON 或 `Object` 掩盖契约。
- package 就近：功能私有类型、mapper、assembler、helper 和配置默认留在当前 feature package；只有满足真实复用时才抽到最近公共父级 package。
- 依赖显式：统一使用构造函数注入，不写字段注入，不依赖隐式可变状态。
- 校验前置：边界输入优先用 Bean Validation，在 `jakarta.validation` 上声明清晰约束；领域不变量留在领域模型或 use case 中表达。
- 事务收敛：`@Transactional` 只放在真正的 use case / application service 边界；除非已有明确模式支撑，否则不要把远程调用混入数据库事务。
- 持久化封装：Repository 负责持久化访问，不承担 HTTP 拼装、鉴权决策或跨聚合业务编排。
- 失败显性：依赖、配置、输入或状态不满足契约时暴露失败，不写吞错、伪成功、空对象回退或无依据默认值。
- 抽象要付账：不要为了“更像分层架构”机械增加 facade、manager、util、converter 或 wrapper。
- 注释解释意图：注释只说明事务边界、领域约束、兼容限制和非显然取舍，不复述代码流程。

## 推荐 package 形态

优先使用 feature-first 目录，在 feature 内再表达 `api`、`application`、`domain`、`infrastructure` 职责。

```text
src/main/java/com/example/order/
  api/
    OrderController.java
    request/
      CreateOrderRequest.java
    response/
      OrderResponse.java
  application/
    CreateOrderService.java
    command/
      CreateOrderCommand.java
  domain/
    Order.java
    OrderRepository.java
    OrderDomainService.java
  infrastructure/
    persistence/
      JpaOrderRepository.java
      SpringDataOrderRepository.java
```

已有项目若稳定使用分层 package，可以沿用，但必须保持边界清晰，不能因为沿用旧结构就放任跨层耦合。

## 分层职责

### api

- 处理 HTTP 路由、认证上下文读取、请求解析、参数校验和响应映射。
- request / response 类型只表达传输契约，不承载持久化注解或领域行为。
- 多字段入参优先使用 request DTO 或 `record`，不要堆叠长参数列表。

### application

- 承载 use case 编排、事务边界、权限决策协调和跨仓储流程。
- command / query 模型表达用例输入，不把 Controller request 直接下传到领域或持久化层。
- application service 返回领域结果或明确 DTO，不返回 `ResponseEntity`、Servlet API 或框架细节。

### domain

- 承载聚合、值对象、领域服务、领域规则和仓储接口。
- 领域规则优先放入聚合或值对象，不要把核心规则散落在 controller 或 repository。
- 领域层不依赖 Web、JPA 或传输层细节；必要时通过接口反转依赖。

### infrastructure

- 放置 JPA 实体、Spring Data repository、外部网关、消息实现、第三方客户端和配置适配。
- 基础设施实现依赖 domain / application 契约，不反向让上层依赖实现细节。

## Spring Boot 具体约束

- 统一使用构造函数注入；禁止 `@Autowired` 字段注入。
- 输入校验优先使用 `@Valid`、`@Validated` 和 `jakarta.validation` 注解。
- 全局异常映射优先收敛到 `@ControllerAdvice`，避免在 controller 内逐个 try/catch。
- 配置绑定优先使用 `@ConfigurationProperties`，不要到处直接读裸字符串配置。
- DTO、entity、领域对象分离；除非项目已明确接受耦合，否则不要直接把 JPA entity 暴露给 API。
- 数据库迁移优先使用 Flyway 或 Liquibase；结构变更必须通过迁移脚本表达，不手工假设线上状态。
- Maven 和 Gradle 都应依赖项目现有构建入口，不得用仓库根级共享脚本替代当前 skill 的自校验脚本。

## 抽离与共享

- 只有出现至少三个独立使用点，才把公共代码抽到最近公共父级 package。
- 抽离目标必须位于最近公共父级的直接共享 package，不得跨过最近公共父级直接丢到更高层 `common`、`shared` 或 `utils`。
- `support`、`common`、`shared` 这类 package 只有在真实复用成立时才创建，不能当作默认垃圾桶。

## 完成前检查

- package 边界是否围绕当前业务能力，而不是继续迁就旧结构。
- Controller、application、domain、infrastructure 的职责是否混淆。
- 是否统一使用构造函数注入、Bean Validation、显式事务边界和稳定错误映射。
- 是否通过迁移脚本表达数据库变更，并保持 Repository 与 API 契约解耦。
- 是否运行了与风险匹配的现有检查、测试、构建或启动验证。

## GraphQL 场景说明

本 Skill 主要面向 REST/HTTP API 场景。Spring GraphQL 项目可参考以下适配：

- `@QueryMapping`/`@MutationMapping` 对应 api 层：负责参数提取和响应映射，不直接编排跨仓储流程。
- 输入校验：GraphQL Input Type 配合 `@Valid` 和 `jakarta.validation` 仍然有效。
- DataFetcher/BatchLoader：用于解决 N+1 问题，属于 infrastructure 层的数据访问优化。
- Subscription：使用 `@SubscriptionMapping`，协议适配属于 api 层，事件产生属于 application 层。

分层原则（api → application → domain → infrastructure）同样适用，只是入口从 `@RestController` 变为 `@Controller` + GraphQL mapping 注解。

## 辅助资源

- 示例：`examples/spring-boot-structure.md`
- 评审示例：`examples/review-output.md`
- 校验清单：`validation/checklist.md`
- 自校验脚本：`scripts/verify-rules.mjs`
