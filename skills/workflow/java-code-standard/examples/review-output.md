# Java 后端评审输出示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 评审结果示例

- 目标分类：`application-module`
- 检查范围：`src/main/java/com/example/order/application/CreateOrderService.java`、`src/main/java/com/example/order/api/OrderController.java`、`src/main/java/com/example/order/infrastructure/persistence/JpaOrderRepository.java`
- 总结论：`FAIL`

### 问题列表

1. `major`
   - 规则点：统一使用构造函数注入，禁止 `@Autowired` 字段注入。
   - 证据：`src/main/java/com/example/order/application/CreateOrderService.java:15-18`
   - 问题说明：`CreateOrderService` 使用 `@Autowired` 字段注入 `OrderRepository` 和 `PaymentGateway`，导致依赖不透明、测试时无法通过构造函数替换 mock，也违反了不可变性原则。
   - 改动建议：改为构造函数注入，将字段声明为 `private final`，删除 `@Autowired` 注解。

2. `major`
   - 规则点：Controller 不直接操作 Repository，应通过 application service 编排。
   - 证据：`src/main/java/com/example/order/api/OrderController.java:32`
   - 问题说明：`OrderController` 直接注入并调用 `JpaOrderRepository.findById()`，绕过了 application 层的用例编排和事务边界，导致业务逻辑散落在 api 层。
   - 改动建议：在 `src/main/java/com/example/order/application/` 新增 `GetOrderService` 或 `OrderQueryService`，由 Controller 调用 service 而非直接调用 repository。

3. `major`
   - 规则点：输入校验优先使用 `@Valid` 和 `jakarta.validation` 注解。
   - 证据：`src/main/java/com/example/order/api/request/CreateOrderRequest.java:8-15`
   - 问题说明：`CreateOrderRequest` 的 `productId` 和 `quantity` 字段没有任何校验注解，无效请求会直接穿透到 application 层，可能导致空指针或业务异常。
   - 改动建议：为 `productId` 添加 `@NotNull`，为 `quantity` 添加 `@NotNull @Min(1)`，并在 Controller 方法参数上添加 `@Valid`。

4. `minor`
   - 规则点：DTO、entity、领域对象分离，不直接把 JPA entity 暴露给 API。
   - 证据：`src/main/java/com/example/order/api/OrderController.java:45`
   - 问题说明：`getOrder` 方法直接返回 `Order` JPA entity，把持久化细节（`@Entity`、`@Id`、懒加载代理）暴露给 API 调用方，后续 entity 变更会直接影响 API 契约。
   - 改动建议：在 `src/main/java/com/example/order/api/response/` 新增 `OrderResponse` record，由 service 或 controller 负责映射。

## 改动建议汇总

- `src/main/java/com/example/order/application/CreateOrderService.java`
  - 改为构造函数注入，删除 `@Autowired` 字段注入
- `src/main/java/com/example/order/api/OrderController.java`
  - 删除直接注入的 `JpaOrderRepository`，改为调用 application service
  - `getOrder` 方法返回 `OrderResponse` 而非 JPA entity
- `src/main/java/com/example/order/api/request/CreateOrderRequest.java`
  - 为字段添加 `@NotNull`、`@Min` 等校验注解
- `src/main/java/com/example/order/application/`
  - 新增 `GetOrderService` 或 `OrderQueryService` 处理查询用例
- `src/main/java/com/example/order/api/response/`
  - 新增 `OrderResponse` record 作为 API 响应模型
