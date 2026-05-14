# Java 后端规范

## Package 形态

优先遵循项目既有风格。默认特性导向结构：

```text
order/
  OrderController.java
  OrderService.java
  OrderRepository.java
  dto/
  entity/
  exception/
```

如果项目已稳定使用分层导向 package，也可以继续沿用。

## Controller

Controller 处理 HTTP 关注点、validation annotations、request mapping 和 response mapping。业务规则放在 service/use-case 类中。

## Service

Service 承载 use-case 编排、业务规则、鉴权敏感决策和事务边界。

只有需要原子性时才使用 `@Transactional` 或等价机制。除非项目有明确 outbox、saga 或 compensation 模式，否则避免把外部网络调用混入数据库事务。

## Repository

Repository 表达持久化访问。除非项目明确把 query service 视为 read model，否则避免在 repository 查询中嵌入领域决策、鉴权检查或响应整形。

## DTO、Entity 与 Mapper

当字段或约束不同，应保持 request DTO、response DTO、entity 和 mapper 代码分离。

除非项目已采用并接受这种耦合，否则不要在公开或不稳定契约中直接暴露 JPA entity 作为 API 响应。

## 异常

使用显式 domain exceptions 或 framework exceptions，并在一致的 exception handler/advice 层映射为传输响应。

不要捕获宽泛异常后返回空成功响应。
