# Node 后端结构示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## feature-first 模块

```text
src/modules/orders/
  transport/
    orders.controller.ts
    schemas/
      create-order.request.ts
      list-orders.query.ts
    presenters/
      order.presenter.ts
  application/
    create-order.service.ts
    list-orders.service.ts
    commands/
      create-order.command.ts
  domain/
    order.aggregate.ts
    order.repository.ts
    order.errors.ts
    value-objects/
      order-id.ts
  infrastructure/
    persistence/
      postgres-order.repository.ts
    integrations/
      payment-gateway.client.ts
```

## 路由装配与错误收口

```ts
export function registerOrderRoutes(app: FastifyInstance, deps: OrderModuleDeps) {
  app.post('/orders', async (request, reply) => {
    const input = createOrderRequestSchema.parse(request.body)
    const result = await deps.createOrderService.execute(input)
    return reply.code(201).send(orderPresenter.toResponse(result))
  })
}
```

```ts
app.setErrorHandler((error, request, reply) => {
  const mapped = mapErrorToHttpResponse(error)
  reply.code(mapped.statusCode).send(mapped.body)
})
```

- transport 负责协议解析、schema 校验和响应映射，不把业务编排塞进 route。
- 错误统一在边界收口，不在每个 handler 中重复拼装 try/catch 响应。

## Schema 与配置校验

```ts
import { z } from 'zod'

export const createOrderRequestSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    sku: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
})
```

```ts
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PAYMENT_API_BASE_URL: z.string().url(),
})

export const env = envSchema.parse(process.env)
```

- 运行时输入与配置都要做 schema 校验，不能只靠 TypeScript 类型假设数据可靠。
- `process.env` 必须集中校验后再分发，不到处直接读取裸环境变量。

## 应用服务与事务边界

```ts
export class CreateOrderService {
  constructor(
    private readonly unitOfWork: OrderUnitOfWork,
    private readonly orderRepository: OrderRepository,
    private readonly paymentGatewayClient: PaymentGatewayClient,
  ) {}

  async execute(command: CreateOrderCommand) {
    return this.unitOfWork.run(async () => {
      const order = OrderAggregate.create(command)
      await this.orderRepository.save(order)
      await this.paymentGatewayClient.reserve(order.totalAmount)
      return order
    })
  }
}
```

- Service 只做用例编排与事务边界，不直接拼装 HTTP 响应。
- 远程调用是否进入事务必须由项目现有模式支撑，不能隐式混成大事务。

## 持久化封装

```ts
export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly db: SqlClient) {}

  async findById(orderId: OrderId) {
    const row = await this.db.oneOrNone<OrderRow>(
      'select * from orders where id = $1',
      [orderId.value],
    )

    return row ? OrderMapper.toAggregate(row) : null
  }
}
```

- repository 负责持久化访问和映射，不直接返回数据库行对象给 transport。
- application 抛出领域错误或应用错误，由统一错误映射层转换为外部协议语义。
