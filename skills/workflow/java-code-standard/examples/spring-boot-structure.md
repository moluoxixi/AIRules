# Spring Boot 结构示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## feature-first package 示例

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

## request / response 示例

```java
package com.example.order.api.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateOrderRequest(
    @NotBlank String customerId,
    @NotNull Long amount
) {}
```

```java
package com.example.order.api.response;

public record OrderResponse(
    String orderId,
    String status
) {}
```

## 配置绑定示例

```java
package com.example.order.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "order")
public record OrderProperties(
    int expireMinutes,
    boolean asyncEnabled
) {}
```

## 说明

- `api/` 只处理传输契约。
- `application/` 负责用例编排和事务边界。
- `domain/` 表达领域规则和仓储接口。
- `infrastructure/` 放置持久化与外部适配实现。
- `record CreateOrderRequest`、`@ConfigurationProperties` 和 feature-first package 只是推荐示例，最终仍以项目真实约束为准。
