# Java / Spring Boot 结构示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 领域包

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

## 测试镜像

```text
src/test/java/com/example/order/
  application/
    OrderServiceTest.java
  api/
    OrderControllerTest.java
  infrastructure/
    OrderRepositoryTest.java
```

## DTO 与校验

```java
public record CreateOrderRequest(
    @NotBlank String sku,
    @NotNull @Positive Integer quantity
) {}
```

## 构造函数注入

```java
@Service
public class OrderService {
  private final OrderRepository orderRepository;

  public OrderService(OrderRepository orderRepository) {
    this.orderRepository = orderRepository;
  }
}
```

## 配置绑定

```java
@ConfigurationProperties(prefix = "order")
public record OrderProperties(
    @NotNull Duration timeout
) {}
```

## 导入边界

禁止跨领域导入未公开实现类，例如直接引用 `payment.infrastructure.JpaPaymentEntity`。
跨领域协作优先通过应用服务接口、公开 DTO 或端口完成。
