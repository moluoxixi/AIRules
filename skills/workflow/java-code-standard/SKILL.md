---
name: java-code-standard
description: 用于新建、编写、重构、拆分、优化、评审或校验 Java/Spring Boot 后端代码，覆盖 Clean Architecture、DDD 依赖倒置、事务边界、JPA/OSIV、时间契约与质量门禁。
---

# Java 后端实现标准

本文件是 Java 后端实现标准的唯一规则源。不要再跳转到旧的主规范文档，也不得依赖仓库中的其它 project skills 作为实现依据；只有当前项目真实代码、当前任务约束和本 Skill 内规则生效。

## 使用场景

当任务目标是新写接口、重构领域逻辑、整理 package 边界、规范事务和持久化职责、补齐请求校验或统一异常映射时，使用本 Skill。

本 Skill 面向新实现和重构，不面向兼容式修补。旧 package 结构、旧 DTO、旧注入方式、旧事务边界或旧错误映射一旦妨碍当前目标，就直接按标准重建；**绝不为了兼容历史写法而保留冗余的过渡层或伪分层。**

## 工作顺序

1. **理清边界**：先确认业务能力、外部契约、数据边界、事务要求和持久化模型。
2. **职责定位**：判断代码应该留在 feature package 内，还是按领域通用性提升为跨域业务资产或基础支撑。
3. **按规重建**：严格按照本标准的依赖倒置、依赖注入、请求校验、事务边界和持久化规范进行代码编写或重构。
4. **清理垃圾桶**：严禁设立无语义的全局 `utils`，辅助逻辑优先留在 feature 内。
5. **闭环验证**：完成后必须执行现有的 format、lint、test 或按清单执行自检；缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

---

## 1. 核心架构与设计哲学

- **依赖倒置与整洁架构**：严格遵循外层依赖内层的原则。`domain` 位于最核心，完全独立，不依赖 Web、JPA 或 Spring；`application` 编排业务用例；`infrastructure` 位于最外层，负责实现 `domain` 或 `application` 定义的接口。严禁 `domain` 依赖 `infrastructure`。
- **高内聚与反垃圾桶**：类与文件必须保持职责内聚。承担过多职责的文件必须拆分。辅助逻辑（Helper/Mapper）优先留在当前 feature 包内（就近原则）；只有具备明确跨业务域通用语义时，才可提升为 `support` / `common` / `shared`，禁止设立无语义的全局 `utils` 垃圾桶。
- **契约优先 (Contract-First)**：API 边界与用例交互必须使用显式 DTO（优先使用 `record`），严禁使用 `Map`、裸 `JSON` 或 `Object` 作为数据载体。
- **不变性封装 (Immutability)**：领域模型必须保护内部状态。对外暴露集合时，强制使用 `List.copyOf()` 或 `Collections.unmodifiableList()` 返回不可变视图。
- **时间契约 (JSR-310)**：全局禁用 `java.util.Date`、`java.util.Calendar` 与 `java.sql.Timestamp`。强制使用 `java.time`（如 `Instant`、`OffsetDateTime`、`LocalDate`）。
- **失败显性化 (Fail-Fast)**：拒绝吞错与静默失败。预期内业务异常通过自定义领域异常抛出（覆写 `fillInStackTrace()` 优化性能），全局异常遵循 RFC 7807（`ProblemDetail`）统一映射。

## 2. Spring Boot 框架约束

- **强制构造器注入 (Constructor Injection)**：全局禁用 `@Autowired` 字段注入。依赖关系必须显式声明，使用 `final` 修饰并由构造器初始化。
- **输入校验前置 (Bean Validation)**：Controller 的 `@RequestBody`、`@ModelAttribute`、复杂 request DTO、多字段入参或嵌套入参，必须在入口参数处显式添加 `@Valid` 或 `@Validated`。嵌套 DTO 必须在父级字段标注以触发级联校验，例如集合字段应写为 `@Valid @NotNull List<ItemRequest> items`。
- **严禁事务自调用 (No Self-Invocation)**：事务方法必须由 Controller 或其他 Application Service 通过注入的 Spring Bean 从外部调用。若需拆分事务边界，必须提取独立的 Service 类，严禁使用 `this.xxx()` 内部调用或通过 `AopContext.currentProxy()` 等 Hack 手段绕过代理。
- **事务边界显式**：`@Transactional` 只放在真正的 use case / application service 边界；查询类 use case 或不修改数据的 application service 必须显式使用 `@Transactional(readOnly = true)`，减少 Hibernate Dirty Checking 开销，并作为读写分离路由的明确标记。
- **配置强类型绑定**：使用 `@ConfigurationProperties` 映射配置，禁止代码中散落 `@Value` 裸字符串读取。

## 3. 数据与持久化契约 (JPA/Hibernate)

- **禁用 OSIV (Open Session In View)**：必须在配置中显式声明 `spring.jpa.open-in-view: false`。懒加载初始化强制收敛在 Application Service 的 `@Transactional` 边界内，严禁在 Controller、API 序列化或视图层触发。
- **杜绝 N+1 与内存笛卡尔积**：严禁在循环中执行 SQL 或触发懒加载。跨聚合复杂读取（读模型）强制使用 `@EntityGraph`、`JOIN FETCH`、DTO 投影 (Projection)，或直接采用 JOOQ、MyBatis、Spring Data JDBC 等扁平化查询方案，禁止全量加载巨型对象树。
- **实体纯粹性**：JPA Entity 必须为普通 `class`（禁用 `record`），严禁使用 Lombok `@Data`、`@EqualsAndHashCode`、`@ToString`，避免意外触发代理初始化。`equals`/`hashCode` 必须基于稳定的业务唯一键 (Business Key) 手写。
- **仓储职责收敛**：Repository 仅负责持久化状态存取，严禁掺杂 HTTP 上下文解析、权限校验或跨域业务编排。跨域副作用强制通过 `ApplicationEvent` 解耦。

---

## 4. 质量守护门禁 (Quality Gate)

1. **架构守护 (ArchUnit)**：必须编写自动化架构测试，确保以下底线不被击穿：
   - 防御 `domain` 核心层依赖 Spring / JPA / Web 等技术细节。
   - 防御 `application` 或 `api` 直接耦合 `infrastructure` 的实现类（必须依赖接口）。
   - 防御同层不同 feature 之间的无序跨界调用（强制通过明确的 application 契约、领域事件或共享领域模型协作）。
2. **集成测试**：涉及复杂 SQL 与持久化行为，优先使用 **Testcontainers** 挂载真实数据库方言，拒绝 H2 等内存数据库的虚假兼容。
3. **数据库迁移**：Schema 演进强制通过 **Flyway/Liquibase** 脚本版本化控制，严禁手工假设或调整线上表结构。

---

## 检查清单

在提交代码或完成重构前，逐一核对以下事项：

- [ ] 是否彻底消除了 `@Autowired` 字段注入，全部改为构造函数注入？
- [ ] API 的 Request DTO/入参处，是否全部加上了 `@Valid` / `@Validated`？
- [ ] 事务边界内是否**绝对没有** `this.method()` 形式的事务自调用？
- [ ] 查询类 use case 或不修改数据的 application service 是否显式使用 `@Transactional(readOnly = true)`？
- [ ] 是否彻底禁用了 `java.util.Date`、`java.util.Calendar`、`java.sql.Timestamp`，并替换为 `java.time` API？
- [ ] 循环体内是否存在任何数据库查询或懒加载触发（N+1 风险）？
- [ ] JPA Entity 是否清理了 `@Data`、`@EqualsAndHashCode`、`@ToString` 并手写了基于业务主键的 `equals/hashCode`？
- [ ] 工具类或辅助代码是否就近放置在了 feature 目录下，而不是无脑丢进全局 `utils` 包？
- [ ] Domain 层是否保持纯净，没有 import `org.springframework`、`jakarta.persistence`、Servlet、Jackson 等 Web/JPA/框架细节？

## 自校验脚本

执行当前 Skill 目录下的自检脚本以确保规范文本完整：

- `node scripts/verify-rules.mjs`
- `node scripts/verify-rules.mjs hoist --target <package-path>`

*(注：缺少脚本或依赖时标记 `MISSING`，未执行标记 `NOT RUN`，失败标记 `FAIL`。)*

## 评审输出示例

当作为 AI 评审代码时，遵循以下输出格式：

- 目标分类：`application-module`
- 检查范围：`src/main/java/com/example/order/application/CreateOrderService.java`
- 总结论：`FAIL`

1. `major`
   - **规则点**：严禁事务自调用 (Self-Invocation)。
   - **证据**：`CreateOrderService.java:41`
   - **问题说明**：`create()` 方法内部通过 `this.persistWithTransaction()` 调用了标记为 `@Transactional` 的方法，导致 Spring AOP 代理绕过，事务静默失效。
   - **改动建议**：将事务边界提至上层，或将 `persistWithTransaction` 逻辑提取到独立的 Application Service 类中通过构造函数注入调用。

2. `minor`
   - **规则点**：输入校验前置。
   - **证据**：`OrderController.java:25`
   - **问题说明**：`createOrder` 方法的 `CreateOrderRequest` 缺少 `@Valid` 注解，导致 DTO 内部的校验规则不会生效。
   - **改动建议**：在入口参数处显式添加 `@Valid` 注解。
