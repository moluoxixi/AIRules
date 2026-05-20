# NestJS 模块结构示例

本文件只提供示例，不定义新规则。

## feature-first 模块

```text
src/modules/orders/
  orders.module.ts
  controllers/
    orders.controller.ts
    dto/
      create-order.dto.ts
      list-orders.query.dto.ts
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
      order.entity.ts
      typeorm-order.repository.ts
    integrations/
      payment-gateway.client.ts
  shared/
    order-presenter.ts
```

## 模块装配

```ts
@Module({
  controllers: [OrdersController],
  providers: [
    CreateOrderService,
    ListOrdersService,
    {
      provide: OrderRepository,
      useClass: TypeormOrderRepository,
    },
    PaymentGatewayClient,
  ],
})
export class OrdersModule {}
```

- `@Module` 负责声明稳定依赖装配，不把内部实现无边界导出给外层模块。
- controller 留在传输层，application service 留在用例边界，repository 实现放在 infrastructure。

## DTO 与 ValidationPipe

```ts
export class CreateOrderDto {
  @IsUUID()
  customerId!: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[]
}
```

```ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
```

- DTO 使用 `class` 与 `class-validator` 表达输入契约。
- `ValidationPipe` 统一收口边界输入校验，不把校验逻辑散落在 controller 方法体里。

## 应用服务与事务边界

```ts
@Injectable()
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

## 错误与持久化封装

```ts
@Injectable()
export class TypeormOrderRepository implements OrderRepository {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly repository: Repository<OrderEntity>,
  ) {}

  async findById(orderId: OrderId) {
    const entity = await this.repository.findOne({ where: { id: orderId.value } })
    return entity ? OrderMapper.toAggregate(entity) : null
  }
}
```

- repository 负责持久化访问和映射，不直接返回 ORM entity 给 controller。
- Service 抛出领域错误或应用错误，由统一异常映射层转换为外部协议语义。
