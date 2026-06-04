# Java & Spring Boot 工程架构与代码规范

在执行 Java 后端代码生成、重构或评审任务时，必须在当前任务目标与改动范围内严格遵守以下物理边界与编码红线。

## 一、核心架构与设计纪律

- `domain` 位于最核心，禁止依赖 `infrastructure`、Spring、JPA、Servlet、Jackson 或任何技术细节。
- 若现有项目将 JPA Entity、ORM 注解或持久化代理放入 `domain`，必须在当前任务范围内拆分领域模型与持久化实体。
- 类与文件必须保持职责内聚，辅助逻辑必须就近留在 feature 包内。
- 禁止设立无业务语义的全局 `utils` 目录。
- 对外暴露集合时强制使用不可变视图，如 `List.copyOf()` 或 `Collections.unmodifiableList()`。
- 全局禁用 `java.util.Date`、`Calendar` 与 `java.sql.Timestamp`，强制使用 `java.time`。
- API 边界与用例交互必须使用显式 DTO，优先使用 `record`。

## 二、Spring Boot 框架强制约束

- 全局禁用 `@Autowired` 字段注入，所有依赖必须声明为 `final` 并通过构造器注入。
- Controller 层复杂 DTO、集合或入参必须显式标注 `@Valid` 或 `@Validated`。
- 嵌套 DTO 必须在父级字段标注以触发级联。
- 进入 Application/Domain 层后，禁止重复编写基础防御逻辑。
- 禁止 `this.xxx()` 形式内部事务方法调用，也禁止使用 `AopContext.currentProxy()` 绕过代理。
- 涉及 Repository、EntityManager 或持久化上下文的查询类用例，必须显式标记 `@Transactional(readOnly = true)`。

## 三、数据与持久化契约

- 必须显式配置 `spring.jpa.open-in-view: false`。
- 懒加载必须收敛在 `@Transactional` 边界内，禁止在 Controller 层或序列化阶段触发懒加载。
- 禁止在循环体内执行 SQL 或触发懒加载代理。
- 跨聚合查询强制使用 `@EntityGraph`、`JOIN FETCH` 或 DTO Projection。
- JPA Entity 必须是普通 `class`，禁止在 Entity 上使用 Lombok 的 `@Data`、`@EqualsAndHashCode`、`@ToString`。
- Entity 必须基于稳定业务唯一键手写 `equals/hashCode`。
- Repository 仅限持久化存取，禁止混入 HTTP 上下文、权限校验或跨域编排。
