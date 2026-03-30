# Java Comments

JavaDoc conventions for Java / Spring Boot projects.

> **注释语言**：注释语言跟随项目所在地区，详见 [common/comments.md](../common/comments.md)。代码示例使用中文注释。

## Class-Level Documentation

Every public class must have a class-level JavaDoc:

```java
/**
 * 负责订单处理和支付验证的服务
 * 处理订单从创建到完成的完整生命周期
 */
@Service
public class OrderService {
```

## Method Documentation

Public methods must document parameters, return values, and exceptions:

```java
/**
 * 处理指定订单的支付
 *
 * @param orderId 订单的唯一标识符
 * @param paymentRequest 包含支付方式和金额详情
 * @return 包含交易 ID 和状态的 PaymentResult
 * @throws OrderNotFoundException 订单不存在时抛出
 * @throws PaymentFailedException 支付处理器返回错误时抛出
 * @throws IllegalArgumentException 支付金额为负数时抛出
 */
public PaymentResult processPayment(String orderId, PaymentRequest paymentRequest) {
```

## Required Tags

- `@param` - 所有参数，描述约束和有效值
- `@return` - 所有非 void 返回值，描述可能的值
- `@throws` - 所有 checked 异常和重要的 unchecked 异常

## Optional Tags

- `@see` - 相关的类或方法
- `@since` - API 引入时的版本
- `@deprecated` - 附带说明和替代方案

## Code Examples

Include runnable examples for complex APIs:

```java
/**
 * 创建带自定义拒绝策略的缓存线程池
 *
 * <p>使用示例：
 * <pre>{@code
 * ExecutorService executor = ThreadPoolBuilder.create()
 *     .coreSize(4)
 *     .maxSize(16)
 *     .build();
 * }</pre>
 */
```
