---
name: java-code-standard
description: 用于新建、编写、重构、拆分、优化、评审或校验 Java/Spring Boot 后端代码，覆盖 package 边界、分层职责、依赖注入、Bean Validation、事务、迁移和错误映射。
---

# Java 后端实现标准

## 用途

本 Skill 用于新建、编写、重构、拆分、优化、评审或校验 Java 与 Spring Boot 后端代码，覆盖 Java 17+ 基线、Java 21/25 LTS、Maven 和 Gradle 项目。

本文件是 Java 后端实现标准的唯一规则源。不要再跳转到旧的主规范文档，也不得依赖仓库中的其它 project skills 作为实现依据；只有当前项目真实代码、当前任务约束和本 Skill 内规则生效。

## 使用场景

当任务目标是新写接口、重构领域逻辑、整理 package 边界、规范事务和持久化职责、补齐请求校验或统一异常映射时，使用本 Skill。

本 Skill 面向新实现和重构实现，不面向兼容式修补。旧 package 结构、旧 DTO、旧注入方式、旧事务边界或旧错误映射一旦妨碍当前目标，就直接按标准重建；不要为了兼容历史写法保留冗余 service、双 DTO、过渡 mapper 或伪分层。

## 工作顺序

1. 先确认业务能力、外部契约、数据边界、事务要求、持久化模型和项目当前使用的 Spring Boot 基础设施。
2. 判断代码应该留在 feature package 内，还是按领域通用性提升为全局基础设施、跨域业务资产或 feature 内共享支持。
3. 优先复用项目已有成熟库和框架能力，例如 Spring Boot、Spring MVC、Spring Data、Bean Validation、Flyway、Liquibase、MapStruct、Jackson、Testcontainers。
4. 直接按目标职责重建 package、分层职责、依赖注入、请求校验、事务边界和错误映射，不保留无价值兼容层。
5. 完成后按风险执行项目已有 format、lint、test、build、集成测试或启动验证；缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

## 实现原则

- 契约优先：Controller、request、response、command、query 和事件类型必须表达真实边界，不用宽泛 Map、裸 JSON 或 `Object` 掩盖契约。
- package 就近：功能私有类型、mapper、assembler、helper 和配置默认留在当前 feature package；抽离层级由领域通用性决定，而不是调用方物理最近公共父级 package。
- 依赖显式：统一使用构造函数注入，不写字段注入，不依赖隐式可变状态。
- 校验前置：边界输入优先用 Bean Validation，在 `jakarta.validation` 上声明清晰约束；领域不变量留在领域模型或 use case 中表达。
- 事务收敛：`@Transactional` 只放在真正的 use case / application service 边界；查询类 use case 或不修改数据的 application service 必须显式使用 `@Transactional(readOnly = true)`，减少 Hibernate Dirty Checking 开销，并作为读写分离路由的明确标记；除非已有明确模式支撑，否则不要把远程调用混入数据库事务。
- 持久化封装：Repository 负责持久化访问，不承担 HTTP 拼装、鉴权决策或跨聚合业务编排。
- 失败显性：依赖、配置、输入或状态不满足契约时暴露失败，不写吞错、伪成功、空对象回退或无依据默认值；预期内的纯业务规则失败使用领域异常表达，并覆写 `fillInStackTrace()` 返回 `this` 以禁用堆栈抓取，系统级异常仍保留完整堆栈。
- 抽象要付账：不要为了“更像分层架构”机械增加 facade、manager、util、converter 或 wrapper。
- 注释解释意图：注释只说明事务边界、领域约束、兼容限制和非显然取舍，不复述代码流程。

## 推荐 package 形态

优先使用 feature-first 目录，在 feature 内再表达 `api`、`application`、`domain`、`infrastructure` 职责。

````text
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
      OrderRepositoryAdapter.java
      OrderJpaEntity.java
      OrderSpringDataRepository.java
````

已有项目若稳定使用分层 package，可以沿用，但必须保持边界清晰，不能因为沿用旧结构就放任跨层耦合。

## 分层职责

### api

- 处理 HTTP 路由、认证上下文读取、请求解析、参数校验和响应映射。
- request / response 类型只表达传输契约，不承载持久化注解或领域行为。
- 多字段入参优先使用 request DTO 或 `record`，不要堆叠长参数列表。
- API 响应推荐直接返回 `Response DTO`，并配合 `@ResponseStatus` 控制状态码；需要更精确的头部或状态控制时返回 `ResponseEntity<T>`。不要用 HTTP 200 包装业务错误码。

### application

- 承载 use case 编排、事务边界、权限决策协调和跨仓储流程。
- command / query 模型表达用例输入，不把 Controller request 直接下传到领域或持久化层。
- application service 返回领域结果或明确 DTO，不返回 `ResponseEntity`、Servlet API 或框架细节。
- 处理跨聚合副作用或跨域流程时，禁止在一个事务中深度硬编码注入多个域的 Repository；优先发布 Spring `ApplicationEvent` 或使用 `@TransactionalEventListener` 承接领域事件，保持核心链路和副作用解耦。

### domain

- 承载聚合、值对象、领域服务、领域规则和仓储接口。
- 领域规则优先放入聚合或值对象，不要把核心规则散落在 controller 或 repository。
- 领域层不依赖 Web、JPA 或传输层细节；必要时通过接口反转依赖。
- 领域对象必须保护内部状态；对外暴露 `List`、`Set` 等集合字段时，禁止直接返回内部可变引用，必须使用 `Collections.unmodifiableList()`、`Collections.unmodifiableSet()` 或 `List.copyOf()` / `Set.copyOf()` 返回不可变视图，状态修改只能通过显式领域行为方法完成。

### infrastructure

- 放置 JPA 实体、Spring Data repository、外部网关、消息实现、第三方客户端和配置适配。
- 持久化实现优先用 Adapter 模式：`OrderRepositoryAdapter` 实现 domain 层 `OrderRepository`，内部再委托 `OrderSpringDataRepository`；不要让 application 或 domain 直接依赖 Spring Data 细节。
- 基础设施实现依赖 domain / application 契约，不反向让上层依赖实现细节。

## Spring Boot 具体约束

- 统一使用构造函数注入；禁止 `@Autowired` 字段注入。
- 输入校验优先使用 `@Valid`、`@Validated` 和 `jakarta.validation` 注解；多层嵌套 DTO 或 `record` 集合必须在父级字段显式标记 `@Valid`，例如 `@Valid @NotNull List<ItemRequest> items`，否则内层约束不会级联触发。
- 全局异常映射优先收敛到 `@ControllerAdvice`，并优先遵循 RFC 7807，使用 Spring 6 / Spring Boot 3 原生 `ProblemDetail` 作为统一错误响应体，避免自定义五花八门的 Result / Response 包装类。
- 统一日志与追踪：禁止使用 `System.out` 或 `e.printStackTrace()`；统一使用 SLF4J 接口打印日志，在跨层调用、异常捕获或跨系统调用时保留异常堆栈，并配合 `MDC/TraceId` 记录足够排查的上下文信息。
- 配置绑定优先使用 `@ConfigurationProperties`，不要到处直接读裸字符串配置。
- DTO、entity、领域对象分离；除非项目已明确接受耦合，否则不要直接把 JPA entity 暴露给 API。
- JPA Entity 必须使用普通 `class`，禁止使用 `record`，并严禁 Lombok `@Data`、`@EqualsAndHashCode`、`@ToString`；推荐仅保留 `@Getter`，需要变更的字段通过显式业务方法或必要的 `@Setter` 暴露。`equals` / `hashCode` 必须基于稳定业务唯一键手写，禁止基于数据库自增 ID 或所有字段生成。
- 数据库迁移优先使用 Flyway 或 Liquibase；结构变更必须通过迁移脚本表达，不手工假设线上状态。
- Maven 和 Gradle 都应依赖项目现有构建入口，不得用仓库根级共享脚本替代当前 skill 的自校验脚本。

## 抽离与共享

- 按领域边界提升：摒弃死板的“三次法则”。出现 2 个明确独立使用点，或逻辑复杂到需要独立测试边界时即可拆分；抽离层级由领域通用性决定，而不是调用方物理最近公共父级 package。
- 全局基础设施：与具体业务解耦的配置绑定、日志、时间、ID、HTTP client、Jackson 配置、Bean Validation 支撑等，即使当前只有一个使用点，也可以直接提升到全局基础设施 package。
- 架构边界守护：强烈推荐用 ArchUnit 编写 Architecture Tests，自动校验 `api → application → domain → infrastructure` 的单向依赖，以及防腐层不被跨层穿透；持久化集成测试优先使用 Testcontainers，不要用 H2 替代真实数据库方言。
- 跨域业务资产：订单状态、支付状态、租户上下文等一旦发生或预期发生跨业务域复用，应提取到共享领域 package 或独立 module，而不是留在某个 feature 的物理父级下。
- 局部业务逻辑：只服务当前 feature package 的 mapper、assembler、helper、DTO 和测试支撑默认留在当前 feature 内部，不得因为物理路径相近而泄漏到全局 `common`、`shared` 或 `utils`。
- `support`、`common`、`shared` 这类 package 只有在语义边界成立时才创建，不能当作默认垃圾桶。

## 完成前检查

- package 边界是否围绕当前业务能力，而不是继续迁就旧结构。
- Controller、application、domain、infrastructure 的职责是否混淆。
- 是否统一使用构造函数注入、Bean Validation、显式事务边界和稳定错误映射。
- 是否通过迁移脚本表达数据库变更，并保持 Repository 与 API 契约解耦。
- 是否运行了与风险匹配的现有检查、测试、构建或启动验证。
- 是否用 ArchUnit 等 architecture tests 守住分层边界，并用 Testcontainers 验证持久化行为和 SQL 方言。

## GraphQL 场景说明

本 Skill 主要面向 REST/HTTP API 场景。Spring GraphQL 项目可参考以下适配：

- `@QueryMapping`/`@MutationMapping` 对应 api 层：负责参数提取和响应映射，不直接编排跨仓储流程。
- 输入校验：GraphQL Input Type 配合 `@Valid` 和 `jakarta.validation` 仍然有效。
- DataFetcher/BatchLoader：用于解决 N+1 问题，属于 infrastructure 层的数据访问优化。
- Subscription：使用 `@SubscriptionMapping`，协议适配属于 api 层，事件产生属于 application 层。

分层原则（api → application → domain → infrastructure）同样适用，只是入口从 `@RestController` 变为 `@Controller` + GraphQL mapping 注解。

## 示例

### 结构示例

````text
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
      OrderRepositoryAdapter.java
      OrderJpaEntity.java
      OrderSpringDataRepository.java
````

### request / response

````java
package com.example.order.api.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;

public record CreateOrderRequest(
    @NotBlank String customerId,
    @Valid @NotNull List<ItemRequest> items
) {}

public record ItemRequest(
    @NotBlank String sku,
    @Positive long quantity
) {}
````

````java
package com.example.order.api.response;

public record OrderResponse(
    String orderId,
    String status
) {}
````

### 配置绑定

````java
package com.example.order.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "order")
public record OrderProperties(
    int expireMinutes,
    boolean asyncEnabled
) {}
````

### 评审输出示例

- 目标分类：`application-module`
- 检查范围：`src/main/java/com/example/order/application/CreateOrderService.java`、`src/main/java/com/example/order/api/OrderController.java`、`src/main/java/com/example/order/infrastructure/persistence/OrderRepositoryAdapter.java`
- 总结论：`FAIL`

1. `major`
   - 规则点：统一使用构造函数注入，禁止 `@Autowired` 字段注入。
   - 证据：`src/main/java/com/example/order/application/CreateOrderService.java:15-18`
   - 问题说明：`CreateOrderService` 使用 `@Autowired` 字段注入 `OrderRepository` 和 `PaymentGateway`。
   - 改动建议：改为构造函数注入，将字段声明为 `private final`，删除 `@Autowired` 注解。

2. `major`
   - 规则点：Controller 不直接操作 Repository，应通过 application service 编排。
   - 证据：`src/main/java/com/example/order/api/OrderController.java:32`
   - 问题说明：`OrderController` 直接注入并调用 `OrderRepositoryAdapter.findById()`，绕过了 application 层的用例编排和事务边界。
   - 改动建议：在 `src/main/java/com/example/order/application/` 新增 `GetOrderService` 或 `OrderQueryService`，由 Controller 调用 service 而非直接调用 repository。

3. `minor`
   - 规则点：DTO、entity、领域对象分离，不直接把 JPA entity 暴露给 API。
   - 证据：`src/main/java/com/example/order/api/OrderController.java:45`
   - 问题说明：`getOrder` 方法直接返回 `OrderJpaEntity` JPA entity，把持久化细节暴露给 API 调用方。
   - 改动建议：在 `src/main/java/com/example/order/api/response/` 新增 `OrderResponse` record，由 service 或 controller 负责映射。

## 检查清单

1. 是否先确认了业务能力、外部契约、事务要求、持久化模型和 Spring Boot 基础设施？
   - 未阅读时标记 `NOT RUN`，不得伪装成已完成审查。
2. 当前 package 是否围绕 feature 组织，并在内部清楚区分 `api`、`application`、`domain`、`infrastructure`？
   - 若职责混淆，标记 `FAIL`，指出具体 package 和错误耦合点。
3. Controller 是否只处理 HTTP 关注点，请求体是否通过 `jakarta.validation`、`@Valid` 或 `@Validated` 表达输入约束？
   - 若不符合，标记 `FAIL`，指出缺失校验的位置与建议落点。
4. 是否统一使用构造函数注入，没有字段注入、可变单例状态或隐式依赖？
   - 若不符合，标记 `FAIL`，指出具体类和建议替换方式。
5. `@Transactional` 是否只放在 application service 或明确的 use case 边界，查询链路是否显式使用 `@Transactional(readOnly = true)`？
   - 若不符合，标记 `FAIL`，说明错误事务边界、缺失只读事务的位置和应迁移的层次。
6. 跨聚合副作用是否通过事件解耦，而不是在一个事务中硬编码注入多个域的 Repository？
   - 若不符合，标记 `FAIL`，指出跨域耦合点，并建议发布 `ApplicationEvent` 或使用 `@TransactionalEventListener`。
7. Repository 是否只负责持久化访问，没有掺入 HTTP、响应整形、鉴权决策或跨聚合流程？
   - 若不符合，标记 `FAIL`，指出越界逻辑和应回收的层次。
8. DTO、entity、领域对象是否解耦，没有直接把 JPA entity 暴露给 API？
   - 若不符合，标记 `FAIL`，指出具体泄露位置和建议的 request/response 类型。
9. JPA Entity 是否避免 `record`、Lombok `@Data`、`@EqualsAndHashCode`、`@ToString`，并手写基于业务唯一键的 `equals` / `hashCode`？
   - 若不符合，标记 `FAIL`，指出会触发 Lazy Loading、代理初始化或 hash 值变化风险的实体。
10. 领域对象是否保护集合内部状态，没有通过 Getter 暴露可变 `List`、`Set` 引用？
    - 若不符合，标记 `FAIL`，指出绕过领域行为修改状态的位置，并建议返回不可变视图。
11. 数据库结构变更是否通过 Flyway 或 Liquibase 表达？
   - 若缺失迁移脚本，标记 `FAIL` 或 `MISSING`，并说明原因。
12. 公共抽离是否按领域边界提升，而不是机械依据物理最近公共父级 package？
   - 出现 2 个明确独立使用点，或逻辑复杂到需要独立测试边界时即可拆分；全局基础设施可直接上浮，局部业务逻辑应留在当前 feature package 内。
   - 可配合 `verify-rules.mjs hoist` 做边界风险扫描；脚本 `PASS` 只代表扫描完成，`[HOIST_WARNING]` 必须人工复核，不代表实现整体通过。
13. 是否运行了与风险匹配的现有 format、lint、test、build、集成测试或启动验证？
    - 缺少脚本或依赖时标记 `MISSING`，未执行标记 `NOT RUN`，失败标记 `FAIL`。
14. 是否用 ArchUnit 等 architecture tests 守住分层边界，并用 Testcontainers 验证持久化行为和 SQL 方言？
    - 若不符合，标记 `FAIL`，说明缺失的边界守护或数据库替身风险。

## 自校验脚本

- `node scripts/verify-rules.mjs`
- `node scripts/verify-rules.mjs hoist --target src/main/java/com/example/order/shared --uses src/main/java/com/example/order/create/CreateOrderService.java src/main/java/com/example/order/update/UpdateOrderService.java src/main/java/com/example/order/cancel/CancelOrderService.java`
