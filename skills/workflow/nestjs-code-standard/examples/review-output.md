# NestJS 评审输出示例

本文件只提供示例，不定义新规则。

## 评审报告

- 目标分类：`application-module`
- 检查范围：`src/modules/orders/**/*`、`src/main.ts`；已阅读 `orders.module.ts`、`controllers/orders.controller.ts`、`application/create-order.service.ts`、`infrastructure/persistence/typeorm-order.repository.ts`；未检查集成测试，标记 `NOT RUN`
- 总结论：`FAIL`

### 问题列表

1. `major`
   - 规则点：controller 只处理传输层，不直接编排跨仓储流程
   - 证据：`src/modules/orders/controllers/orders.controller.ts:28`
   - 问题说明：controller 直接创建 entity、写 repository 并拼装响应，导致 HTTP 层承担了 application 和 persistence 职责，后续事务边界与错误映射无法稳定收敛。
   - 改动建议：把创建订单流程下沉到 `src/modules/orders/application/create-order.service.ts`，controller 只负责 DTO 入参、调用 service 和响应映射。

2. `critical`
   - 规则点：边界输入优先通过 `class-validator` + `ValidationPipe` 统一校验
   - 证据：`src/main.ts:14`，`src/modules/orders/controllers/dto/create-order.dto.ts:1`
   - 问题说明：应用未注册全局 `ValidationPipe`，`CreateOrderDto` 也没有字段级校验装饰器，当前接口输入契约只停留在 TypeScript 层，运行时无法阻止脏数据进入用例。
   - 改动建议：在 `src/main.ts` 注册 `ValidationPipe`，并为 `CreateOrderDto` 增加 `class-validator` 约束与必要的 `class-transformer` 类型转换。

3. `major`
   - 规则点：repository 只负责持久化访问，不直接暴露 ORM entity 或底层异常给 controller
   - 证据：`src/modules/orders/infrastructure/persistence/typeorm-order.repository.ts:33`
   - 问题说明：repository 将 `OrderEntity` 直接返回给 controller，且未把唯一键冲突等数据库错误转换为领域/应用语义，导致上层耦合 TypeORM 细节。
   - 改动建议：在 repository 内完成 entity 到 aggregate/response model 的映射，并把数据库错误转换为显式领域错误或应用错误。

### 改动建议汇总

- `src/main.ts`
  - 注册全局 `ValidationPipe`，统一收口 DTO 校验与转换。
- `src/modules/orders/controllers/orders.controller.ts`
  - 删除跨仓储业务编排与 entity 构造逻辑，只保留传输层职责。
- `src/modules/orders/controllers/dto/create-order.dto.ts`
  - 增加 `class-validator` 和 `class-transformer` 约束，补齐运行时输入契约。
- `src/modules/orders/application/create-order.service.ts`
  - 承接创建订单用例、事务边界和错误语义。
- `src/modules/orders/infrastructure/persistence/typeorm-order.repository.ts`
  - 回收 ORM 细节泄露，返回稳定领域结果或显式错误语义。
