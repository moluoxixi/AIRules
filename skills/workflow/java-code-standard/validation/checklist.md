# Java 后端校验清单

本文件只提供校验脚本用法和检查清单，不定义新规则；规则以 `SKILL.md` 为准。

## 脚本用法

```bash
node skills/workflow/java-code-standard/scripts/verify-rules.mjs
node skills/workflow/java-code-standard/scripts/verify-rules.mjs hoist --target src/main/java/com/example/order/support --uses src/main/java/com/example/order/create/CreateOrderService.java src/main/java/com/example/order/update/UpdateOrderService.java src/main/java/com/example/order/cancel/CancelOrderService.java
```

## 检查清单

1. 新代码是否按领域 package 组织，而不是全局平铺 Controller、Service、Repository？
2. Controller 是否只做协议适配和校验触发，业务规则是否收敛到 Service 或 Application Service？
3. Request、Response、Domain、Entity 是否分离，是否避免把 JPA Entity 暴露给外部 API？
4. Spring Bean 是否使用构造函数注入，是否避免字段注入和手动 `new` 依赖型组件？
5. 外部输入是否使用 `jakarta.validation` 或等价机制显式校验？
6. 事务边界是否放在用例编排层，失败是否保留真实领域语义？
7. 涉及持久化结构变化时，是否补充 Flyway 或 Liquibase 迁移？
8. 配置是否通过 `@ConfigurationProperties` 或等价类型化配置承载？
9. 外部 Client、消息队列、缓存和调度任务是否有超时、重试和错误传播策略？
10. 抽离复用代码是否满足三次原则，并提取到最近公共父级 package？
