# Java / Spring Boot 后端编码规范

生成、重构或修改 Java 17+ 基线、Java 21/25 LTS 或 Spring Boot 后端代码时，必须将本规范作为 Java 领域的主要编码标准。新项目在依赖兼容时优先选择 Java 21 或 Java 25 LTS；项目、用户或框架约束更严格时，优先遵循更严格的本地规则。

## 1. 核心原则：领域模块与应用边界

每个业务领域都应形成内聚的 package 边界，避免把所有 Controller、Service、Repository 分散到全局平铺目录。

- 按业务领域组织 package：优先 `order`、`user`、`payment` 等领域目录，而不是全局 `controller/`、`service/`、`repository/`。
- Controller 不承载业务规则：Controller 只负责协议适配、参数接收、校验触发、用例调用和响应组装。
- Service 或 Application Service 编排业务用例：事务、状态流转、跨 Repository 编排和领域规则必须收敛在清晰的应用边界。
- Domain 保持业务语义：领域模型、值对象和领域异常不依赖 HTTP、数据库框架或 Web 层 DTO。
- Infrastructure 隔离外部细节：数据库、消息队列、缓存、第三方 API 和文件系统访问必须留在基础设施层或适配器中。

## 2. 目录形态标准

Spring Boot 业务模块建议按领域聚合。目录名称可遵循项目既有包名，但职责边界必须保持清晰。

```text
src/main/java/com/example/order/
  api/
    OrderController.java
    request/
      CreateOrderRequest.java
    response/
      OrderResponse.java
  application/
    OrderService.java
    OrderMapper.java
  domain/
    Order.java
    OrderStatus.java
    OrderException.java
  infrastructure/
    OrderRepository.java
    JpaOrderEntity.java
  config/
    OrderProperties.java
```

测试目录必须镜像被测领域，优先覆盖用例行为和边界失败，而不是只验证 mock 调用次数。

```text
src/test/java/com/example/order/
  application/
    OrderServiceTest.java
  api/
    OrderControllerTest.java
  infrastructure/
    OrderRepositoryTest.java
```

## 3. Java 语言与类型实践

- 使用项目基线支持的现代 Java 特性。Java 17+ 可优先使用 `record` 表达不可变 DTO、查询结果和轻量值对象；Java 21/25 LTS 项目可按团队约束使用模式匹配、虚拟线程等稳定特性。
- `Optional` 只用于返回值表达“可能不存在”；禁止把 `Optional` 用作字段、DTO 属性或方法参数。
- 集合返回值必须返回空集合或真实集合，不返回 `null`；但禁止用空集合掩盖上游数据缺失或契约错误。
- 不可变优先：DTO、值对象和配置对象优先使用 `record`、不可变字段或构造后不可变结构。
- 泛型必须表达真实类型约束；禁止用 raw type、`Object`、宽泛 `Map<String, Object>` 逃避建模。
- 时间类型优先使用 `java.time`；禁止使用过时的 `Date` / `Calendar` 表达新业务契约。

## 4. API 契约与校验

- 外部请求对象必须使用 `jakarta.validation` 或等价机制声明校验规则，例如 `@NotBlank`、`@NotNull`、`@Size`、`@Email`。
- Controller 入参必须触发校验，例如 Spring MVC 中使用 `@Valid` / `@Validated`。
- 禁止把 JPA Entity 直接作为 API Request 或 Response；Request、Response、Domain、Entity 必须按职责拆分。
- Response 结构必须稳定，字段命名、空值策略、分页结构和错误结构应由显式契约定义。
- Mapper 负责 DTO、Domain 和 Entity 的边界转换；复杂映射可使用 MapStruct 等成熟库，禁止在 Controller 中散落复制字段。

## 5. 依赖注入、事务和错误语义

- Spring Bean 必须使用构造函数注入，优先 `final` 字段；禁止字段注入，除非测试或框架限制已经明确证明无法避免。
- 禁止在业务代码中手动 `new` 依赖型 Service、Repository、Client 或 Mapper；跨模块协作必须通过构造函数注入或明确的端口接口完成。
- `@Transactional` 必须放在应用用例或 Service 编排边界；只读查询使用 `readOnly = true`；避免在 Controller、Repository 或私有 helper 上随意扩散事务。
- 业务失败必须抛出领域错误或应用错误，保留真实失败语义；禁止返回伪成功对象或吞掉异常。
- HTTP 错误映射由 `ControllerAdvice`、异常处理器或框架统一机制完成，可映射为 `ProblemDetail` 或项目统一错误响应。
- 捕获异常只能用于补充上下文、转换为等价失败语义或清理资源，必须重新抛出或显式返回错误结果。

## 6. 持久化、迁移和配置

- Repository 只负责数据访问，不承载业务规则、权限判断或跨聚合状态流转。
- 修改 Entity、表结构、索引、约束、枚举持久化值或初始化数据时，必须判断是否需要迁移；需要时使用 Flyway 或 Liquibase 补充可重复执行的迁移脚本。
- 禁止依赖 Hibernate `ddl-auto=update` 作为正式迁移机制；本地开发可用，但交付变更必须有可审查的迁移记录。
- 配置必须使用 `@ConfigurationProperties` 或等价类型化配置承载，并通过校验约束表达必填项、范围和格式。
- 外部 Client、消息队列、缓存和任务调度必须有明确超时、重试和错误传播策略；禁止静默 fallback 或伪造成功响应。

## 7. 依赖流向与复用

- 领域内部可自上而下依赖：api 调用 application，application 调用 domain 与 infrastructure 端口。
- 禁止同级跨域私有访问：`order` 领域不得直接导入 `payment` 内部未公开的实现类。
- 严格重构三次原则：只有当明确发现某段逻辑在至少 3 个独立地方重复时，才允许触发抽离。
- 最近公共父级：触发抽离后，必须提取到这些使用点的最近公共父级 package，禁止一步塞进全局 `common`。
- 全局门槛：只有跨顶级业务域复用且满足三次原则时，才允许进入 `shared`、`common` 或平台层 package。

## 8. 注释与文档契约

- 公共 Service 方法、复杂事务、领域异常和外部 DTO 必须写清业务契约、边界条件和失败语义。
- 注释解释 Why over What：说明为什么需要事务、锁、幂等键、状态限制或异常转换；禁止写“查询数据库”“保存订单”这类翻译代码的注释。
- 公共 API 变更必须同步 OpenAPI、README、接口文档或契约测试中对应的可见契约。

## 9. AI 执行验证检查清单

在每次输出文件路径或生成代码前，必须在内心执行以下自检，不输出自检过程。

1. 新代码是否按领域 package 组织，而不是全局平铺 Controller、Service、Repository？
2. Controller 是否只做协议适配和校验触发，业务规则是否收敛到 Service 或 Application Service？
3. Request、Response、Domain、Entity 是否分离，是否避免把 JPA Entity 暴露给外部 API？
4. Spring Bean 是否使用构造函数注入，是否避免字段注入和手动 `new` 依赖型组件？
5. 事务边界是否放在用例编排层，失败是否保留真实领域语义？
6. 涉及持久化结构变化时，是否补充 Flyway 或 Liquibase 迁移？
7. 抽离复用代码是否满足三次原则，并提取到最近公共父级 package？
