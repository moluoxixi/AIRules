# NestJS 规范

## Module 边界

项目支持时，按业务模块组织代码：

```text
orders/
  orders.module.ts
  orders.controller.ts
  orders.service.ts
  dto/
  entities/
  repositories/
```

Shared module 只放真正共享的 provider。不要过早把特性专属 provider 移入 shared module。

## Controller

Controller 适合：
- 声明路由和传输层元数据；
- 接收已校验 DTO；
- 调用 service 方法；
- 在需要时映射传输层响应细节。

Controller 不适合承载业务规则、数据库查询、事务编排或外部服务流程。

## Service

Service 适合：
- 编排 use case；
- 执行业务规则；
- 协调 repositories 和外部 adapters；
- 按项目模式定义事务范围；
- 对失败抛出显式 domain 或 framework exceptions。

## DTO 与校验

DTO 表示请求或响应契约。校验方式遵循项目模式，例如 pipes、class-validator、Zod 或 schema validation。

当 DTO 存在时，不要把 controller body 当成无类型字典使用。

## Guards, Pipes, Interceptors, Filters

- guards：鉴权和访问检查；
- pipes：转换和校验；
- interceptors：序列化、耗时统计、响应包装等横切行为；
- filters：异常到响应的映射。

不要在 interceptors 或 filters 中把业务失败隐藏成成功响应。

## 异常

对无效状态、资源缺失、鉴权失败和冲突条件使用显式异常。包装基础设施错误时保留 cause context。
