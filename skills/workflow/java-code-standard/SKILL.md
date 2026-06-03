---
name: java-code-standard
description: 触发时机：当用户要求新建、编写、重构、拆分、优化、评审或校验 Java/Spring Boot 后端代码时触发。
---

# Java & Spring Boot 工程架构与代码规范

在执行 Java 后端代码生成、重构或评审任务时，必须在当前任务目标与改动范围内严格遵守以下物理边界与编码红线。本文件是唯一规则源，绝不为了兼容目标范围内的历史旧代码而保留过渡层或伪分层。

## 一、核心架构与设计纪律

- **依赖倒置**：`domain` 位于最核心，完全独立。严禁 `domain` 依赖 `infrastructure`、`org.springframework`、`jakarta.persistence`、Servlet、Jackson 或任何技术细节。若现有项目将 JPA Entity、ORM 注解或持久化代理放入 `domain`，必须在当前任务范围内拆分领域模型与持久化实体。
- **高内聚与反垃圾桶**：类与文件必须保持职责内聚。辅助逻辑（Helper/Mapper）必须就近留在 feature 包内；绝对禁止设立无业务语义的全局 `utils` 目录。
- **不可变与时间契约**：对外暴露集合时强制使用不可变视图（如 `List.copyOf()` 或 `Collections.unmodifiableList()`）。全局禁用 `java.util.Date`、`Calendar` 与 `java.sql.Timestamp`，强制使用 `java.time` 包下的现代 API（如 `Instant`, `OffsetDateTime`）。
- **显式 DTO**：API 边界与用例交互必须使用显式 DTO（优先使用 `record`），严禁使用 `Map`、裸 `JSON` 或 `Object` 作为载体。

## 二、Spring Boot 框架强制约束

- **依赖注入**：全局禁用 `@Autowired` 字段注入。所有依赖必须显式声明为 `final` 并通过构造器注入。
- **校验前置 (Fail-Fast)**：Controller 层的复杂 DTO、集合或入参，必须显式标注 `@Valid` 或 `@Validated`。嵌套 DTO 必须在父级字段标注以触发级联。进入 Application/Domain 层后，禁止重复编写基础防御逻辑（如空值、正则校验或 `.trim()`）。
- **事务红线 (Transaction Boundaries)**：
  - **严禁自调用**：绝对禁止 `this.xxx()` 形式的内部事务方法调用，也禁止使用 `AopContext.currentProxy()` 绕过代理。拆分事务必须提取独立 Service 并通过注入调用。
  - **读写分离标记**：涉及 Repository、EntityManager 或持久化上下文的查询类用例，必须显式标记 `@Transactional(readOnly = true)`，避免无意义的 Hibernate Dirty Checking。

## 三、数据与持久化契约 (JPA/Hibernate)

- **禁用 OSIV**：必须显式配置 `spring.jpa.open-in-view: false`。懒加载必须收敛在 `@Transactional` 边界内，绝对禁止在 Controller 层或序列化阶段触发懒加载。
- **杜绝 N+1 查询**：严禁在循环体内执行 SQL 或触发懒加载代理。跨聚合查询强制使用 `@EntityGraph`、`JOIN FETCH` 或 DTO 投影（Projection）。
- **实体纯粹性**：JPA Entity 必须是普通 `class`。绝对禁止在 Entity 上使用 Lombok 的 `@Data`、`@EqualsAndHashCode`、`@ToString` 以防意外触发代理。必须基于稳定业务唯一键 (Business Key) 手写 `equals/hashCode`。
- **Repository 职责**：Repository 仅限持久化存取，严禁混入 HTTP 上下文、权限校验或跨域编排。

## 四、强制验证与交付动作 (Mandatory Actions)

任务完成后，必须自动执行以下操作，并严格按模板输出报告：

1. **执行 Skill 自检脚本**：在 `skills/workflow/java-code-standard` 目录执行 `node scripts/verify-rules.mjs`。若当前上下文是目标 Java 项目且不存在该脚本，标记为 `MISSING`；不得用 Skill 自检脚本替代目标项目自身的 Maven/Gradle/lint/test。
2. **执行项目质量检查**：优先运行当前项目已有的 Java 构建、测试或 lint 命令；缺少脚本、配置或依赖时标记为 `MISSING`，未执行时标记为 `NOT RUN`。
3. **输出交付与评审报告**：严格使用以下 Markdown 格式输出结论，禁止任何套话：

```markdown
### 代码合规自校验报告
- **注入合规**：PASS / FAIL / MISSING / NOT RUN / N/A - 已彻底消除 `@Autowired` 字段注入。
- **校验合规**：PASS / FAIL / MISSING / NOT RUN / N/A - Request DTO/入口已全部覆盖 `@Valid` / `@Validated`。
- **事务合规**：PASS / FAIL / MISSING / NOT RUN / N/A - 不存在 `this.xxx()` 事务自调用，且只读方法已加 `readOnly = true`。
- **时间契约**：PASS / FAIL / MISSING / NOT RUN / N/A - 已全部使用 `java.time` API。
- **JPA 合规**：PASS / FAIL / MISSING / NOT RUN / N/A - Entity 未使用 `@Data`，且循环体内无查询逻辑。

### 脚本执行结果 (Status: PASS / FAIL / MISSING / NOT RUN)
- `node scripts/verify-rules.mjs`：输出简述；无法执行时说明原因。
- 项目质量命令：输出简述；缺少命令时标记 `MISSING`。

### 评审异常点
*(如无异常，填“无”)*
- **级别**：Critical / Major / Minor
- **文件与行号**：`xxx.java:41`
- **违规说明**：...
- **修复建议**：...
```
