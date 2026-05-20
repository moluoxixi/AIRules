# Java 后端校验清单

本文件只提供校验脚本用法和检查清单，不定义新规则；规则以 `SKILL.md` 为准。

## 脚本用法

```bash
node skills/workflow/java-code-standard/scripts/verify-rules.mjs
node skills/workflow/java-code-standard/scripts/verify-rules.mjs hoist --target src/main/java/com/example/order/support --uses src/main/java/com/example/order/create/CreateOrderService.java src/main/java/com/example/order/update/UpdateOrderService.java src/main/java/com/example/order/cancel/CancelOrderService.java
```

## 检查清单

1. 是否先确认了业务能力、外部契约、事务要求、持久化模型和 Spring Boot 基础设施？
   - 未阅读时标记 `NOT RUN`，不得伪装成已完成审查。
2. 当前 package 是否围绕 feature 组织，并在内部清楚区分 `api`、`application`、`domain`、`infrastructure`？
   - 若职责混淆，标记 `FAIL`，指出具体 package 和错误耦合点。
3. Controller 是否只处理 HTTP 关注点，请求体是否通过 `jakarta.validation`、`@Valid` 或 `@Validated` 表达输入约束？
   - 若不符合，标记 `FAIL`，指出缺失校验的位置与建议落点。
4. 是否统一使用构造函数注入，没有字段注入、可变单例状态或隐式依赖？
   - 若不符合，标记 `FAIL`，指出具体类和建议替换方式。
5. `@Transactional` 是否只放在 application service 或明确的 use case 边界？
   - 若不符合，标记 `FAIL`，说明错误事务边界和应迁移的位置。
6. Repository 是否只负责持久化访问，没有掺入 HTTP、响应整形、鉴权决策或跨聚合流程？
   - 若不符合，标记 `FAIL`，指出越界逻辑和应回收的层次。
7. DTO、entity、领域对象是否解耦，没有直接把 JPA entity 暴露给 API？
   - 若不符合，标记 `FAIL`，指出具体泄露位置和建议的 request/response 类型。
8. 数据库结构变更是否通过 Flyway 或 Liquibase 表达？
   - 若缺失迁移脚本，标记 `FAIL` 或 `MISSING`，并说明原因。
9. 公共抽离是否满足至少三个独立使用点，并且落在最近公共父级 package？
   - 可配合 `verify-rules.mjs hoist` 校验；脚本 `PASS` 只代表抽离位置通过，不代表实现整体通过。
10. 是否运行了与风险匹配的现有 format、lint、test、build、集成测试或启动验证？
    - 缺少脚本或依赖时标记 `MISSING`，未执行标记 `NOT RUN`，失败标记 `FAIL`。

## 评审输出最低要求

- 先写本次检查范围和主要读取的文件。
- 给出总结论：`PASS`、`FAIL`、`MISSING` 或 `NOT RUN`。
- 每个问题都要包含：规则点、证据（文件路径和位置）、问题说明、可执行的改动建议。
- 不得把脚本 `PASS`、未检查项或缺失脚本写成整体 `PASS`。
