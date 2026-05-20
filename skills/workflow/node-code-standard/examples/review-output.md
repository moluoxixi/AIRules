# Node 后端评审输出示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 评审结果示例

- 目标分类：`application-module`
- 检查范围：`src/modules/orders/application/create-order.service.ts`、`src/modules/orders/transport/orders.controller.ts`、`src/modules/orders/infrastructure/persistence/postgres-order.repository.ts`
- 总结论：`FAIL`

### 问题列表

1. `major`
   - 规则点：application 负责用例编排和事务边界，不把原始 HTTP request 对象透传到下层。
   - 证据：`src/modules/orders/application/create-order.service.ts:12`
   - 问题说明：`CreateOrderService` 直接接收 Fastify `request` 对象并从中读取 body 与 headers，导致 application 与 transport 框架强耦合，后续无法在队列消费者或定时任务中复用该用例。
   - 改动建议：在 `src/modules/orders/application/commands/create-order.command.ts` 建立明确 command，由 `src/modules/orders/transport/orders.controller.ts` 负责把请求映射为 command，再调用 service。

2. `major`
   - 规则点：repository 只负责持久化和映射，不夹带跨聚合业务流程。
   - 证据：`src/modules/orders/infrastructure/persistence/postgres-order.repository.ts:48`
   - 问题说明：repository 在保存订单后直接调用支付网关预占额度，把外部集成流程藏进持久化层，导致事务边界不透明，也破坏了 repository 的职责单一性。
   - 改动建议：把支付预占逻辑移回 `src/modules/orders/application/create-order.service.ts`，repository 仅保留数据库访问与映射。

3. `minor`
   - 规则点：边界输入必须有运行时校验，不能只靠 TypeScript 类型。
   - 证据：`src/modules/orders/transport/orders.controller.ts:9`
   - 问题说明：当前只声明了 `CreateOrderBody` TypeScript 类型，没有实际 schema 解析，线上无效请求会直接穿透到 application 层。
   - 改动建议：在 `src/modules/orders/transport/schemas/create-order.request.ts` 增加 Zod schema，并在 controller 中先 parse 再下传。

## 改动建议汇总

- 在 transport 层建立 request schema 与 command 映射。
- 在 application 层收敛事务和跨依赖编排。
- 在 infrastructure 层删除支付调用，只保留持久化访问。
