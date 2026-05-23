---
name: nestjs-code-standard
description: 用于新建、编写、重构、拆分、优化、评审或校验 NestJS 后端代码，覆盖 module、controller、DTO、provider、事务、持久化、错误映射和领域边界。
---

# NestJS 后端实现标准

## 用途

本 Skill 用于新建、编写、重构、拆分、优化、评审或校验 NestJS 后端代码，覆盖模块设计、控制器契约、DTO 校验、应用编排、领域边界、持久化封装、事务控制和评审输出。

本文件是 NestJS 后端实现与评审的唯一规则源。不要跳转到仓库中的其它 project skills 作为实现依据；只有当前项目真实代码、当前任务约束和本 Skill 内规则生效。

## 使用场景

当任务目标是新增接口、重构模块、收敛服务职责、补齐 DTO 校验、调整事务边界、清理 repository 越界逻辑，或评审现有 NestJS 代码是否符合后端最佳实践时，使用本 Skill。

本 Skill 面向新实现和重构实现，不面向兼容式修补。旧模块结构、旧 DTO、旧 provider 组织、旧事务边界或旧错误映射妨碍当前目标时，直接按标准重建；不要为了兼容历史写法保留冗余 facade、双 service、过渡 mapper 或伪分层。

## 工作顺序

1. 先确认业务能力、外部契约、模块边界、事务要求、持久化模型和当前项目使用的 Nest 基础设施。
2. 判断代码应留在当前 feature module 内，还是按领域通用性提升为全局基础设施、跨域业务资产或模块内共享支持。
3. 优先复用项目已有成熟库和框架能力，例如 NestJS、`ValidationPipe`、`class-validator`、`class-transformer`、ORM、事务工具和测试工具。
4. 直接按目标职责重建 controller、DTO、application、domain、infrastructure 和 provider 关系，不保留无价值兼容层。
5. 完成后按风险执行项目已有 lint、test、build、启动验证或集成测试；缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

## 实现原则

- 契约优先：HTTP 输入输出、command、query、事件和配置类型必须表达真实边界，不用 `any`、宽泛对象、裸 JSON 或可选字段堆砌掩盖契约。
- OpenAPI 同步：如果项目启用了 OpenAPI（Swagger），DTO 类属性必须使用 `@ApiProperty()` 或 `@ApiPropertyOptional()` 声明字段类型、描述和必要示例；Controller 使用 `@ApiOperation()`、`@ApiResponse()` 等装饰器表达接口业务语义，确保生成文档与真实契约一致。
- 失败显性：依赖、配置、输入或状态不满足契约时暴露失败，不写吞错、伪成功、空对象回退或无依据默认值。
- 构造函数注入：统一使用构造函数注入 provider，不写字段注入、隐式单例状态或横向读取容器。
- 校验前置：边界输入优先在 DTO 上通过 `class-validator` 表达，并配合 `ValidationPipe` 统一收口；领域不变量留在领域模型或 use case 中表达。
- 边界清晰：controller 只处理传输层；application 负责用例编排和事务边界；domain 承载业务规则；infrastructure 封装数据库、消息和第三方调用。
- 事务收敛：事务只放在真正的应用用例边界；除非项目已有明确模式支撑，否则不要把远程调用和数据库事务混成一个隐式大事务。
- 持久化封装：repository 和 adapter 只负责持久化或外部依赖访问，不承担 HTTP 拼装、响应整形、鉴权决策或跨聚合流程。
- 按领域边界提升：摒弃死板的“三次法则”。出现 2 个明确独立使用点，或逻辑复杂到需要独立测试边界时即可拆分；抽离层级由领域通用性决定，而不是调用方物理最近公共父级。
- 全局基础设施：与具体业务解耦的配置模块、日志、时间、ID、HTTP client、pipe、filter、interceptor 等，即使当前只有一个使用点，也可以直接提升到全局基础设施层。
- 跨域业务资产：订单状态、支付状态、租户上下文等一旦发生或预期发生跨业务域复用，应提取到共享领域目录、shared-support 或独立 Nest module，而不是留在某个 feature 的物理父级下。
- 局部业务逻辑：只服务当前 feature module 的 helper、mapper、DTO、provider 和测试支撑默认留在当前模块内部，不得因为物理路径相近而泄漏到全局 `common`、`shared` 或 `utils`。
- 抽象要付账：不要为了“更像 Nest 项目”机械增加 facade、manager、assembler、util、wrapper 或空 module。
- 注释解释意图：注释只说明事务边界、领域约束、模块协作和非显然取舍，不复述代码流程。

## 目标分类

- `entrypoint`：`main.ts`、全局 `ValidationPipe`、全局 filter、全局 interceptor、应用启动与装配。
- `application-module`：以某个业务能力为中心的 Nest feature module，内部区分用例编排与依赖装配。
- `domain-module`：聚合、值对象、领域服务、领域错误和仓储契约。
- `infrastructure-adapter`：数据库仓储实现、外部 API client、消息实现、缓存、文件存储等。
- `shared-support`：满足真实复用后上浮的共享契约、工具、装饰器或模块支持代码。
- `mixed-module`：当前目录同时混入多层职责，通常意味着需要收敛边界并重构。

## NestJS 分层与职责边界

### controller

- 处理路由、参数提取、认证上下文读取、DTO 入参校验和响应映射。
- controller 不直接编排跨仓储流程，不直接写事务，不直接操作 ORM entity。
- request / response DTO 只表达传输契约，不承载持久化注解或领域行为。
- 尽量避免在 controller 中直接注入 `@Req()`、`@Res()` 或 `@Headers()`；用户身份上下文、租户 ID、Request ID 等通用数据应封装为自定义参数装饰器（Custom Route Decorator，例如 `@CurrentUser()`）后再读取。

### application

- 承载 use case 编排、事务边界、权限决策协调和跨仓储流程。
- application service 接收 command / query 或明确 DTO，不把 controller request 原样透传到 domain 或 infrastructure。
- application service 返回领域结果或稳定响应模型，不返回 `Response`、`Request` 或其它 HTTP 宿主细节。
- 若项目采用 CQRS 模式，优先使用官方 `@nestjs/cqrs`，由 application 层的 `CommandHandler`、`QueryHandler` 或事件处理器承载具体指令处理；不要自行实现一套 Bus 调度器，也不要把只命名为 Command 的 DTO 直接透传给普通 service 伪装成 CQRS。

### domain

- 承载聚合、值对象、领域服务、领域规则、领域事件和仓储接口。
- 领域规则优先放在聚合、值对象或领域服务中，不要散落在 controller、pipe 或 repository 实现里。
- domain 不依赖 Web 宿主对象或 ORM 细节；必要时通过接口反转依赖。
- 原则上 domain 不依赖框架装饰器；为兼顾开发效率，允许 Domain Service 使用 `@Injectable()` 接入 NestJS DI 容器，但严禁在 domain 层引入 HTTP、GraphQL、Swagger 或特定 ORM 相关注解。

### infrastructure

- 放置 ORM entity、repository 实现、第三方客户端、消息发布实现、缓存适配器和配置适配。
- infrastructure 依赖 domain / application 契约实现，不反向让上层依赖 ORM、SDK 或传输细节。

## NestJS 专项约束

- `ValidationPipe` 应作为统一输入校验入口；参数、body、query、param 的 DTO 校验必须可追踪。
- DTO 使用 `class` 与 `class-validator` 表达契约，不用 interface 冒充运行时校验对象。
- 响应数据必须使用 `class-transformer` 的 `@Exclude()`、`@Expose()` 配合全局或局部 `ClassSerializerInterceptor` 做序列化过滤；严禁将包含密码、密钥、内部状态、审计字段或 ORM lazy relation 的底层对象直接暴露给前端。
- provider 依赖通过构造函数声明，不用从模块外部隐式读取实例。
- 领域层定义的接口契约若需通过 NestJS DI 容器注入，必须定义为 `abstract class` 或使用显式的 `Inject('TOKEN')`，禁止直接注入 TypeScript `interface`。
- `@Module` 只暴露稳定 provider 和 controller；不要把内部实现无边界 export 给外层模块。
- 必须使用 NestJS 的 `Exception Filter`（`@Catch()`）作为统一异常映射层；Application 层和 Domain 层只允许抛出领域自定义错误或原生异常，严禁在业务逻辑中散落 `try-catch` 进行 HTTP 协议转换。
- 领域层和应用层的自定义异常应继承统一基类（例如 `BaseDomainException` 或 `BaseApplicationException`），并在基类契约中暴露稳定错误码；全局 Exception Filter 通过识别基类特征映射 HTTP 状态码和响应体，避免在 Filter 中编写无尽的异常类型枚举。
- 环境变量与应用配置必须使用 `@nestjs/config` 配合 `class-validator` 或 `Joi` 进行启动时强类型校验；若配置缺失，必须在启动阶段快速失败（Fail Fast），禁止运行时 fallback。
- 单元测试与集成测试必须使用 `@nestjs/testing` 的 `Test.createTestingModule` 进行上下文隔离；依赖 Mock 优先通过复写 Provider（`overrideProvider`）实现，禁止直接修改全局模块或硬编码类实例化链。
- exception filter、interceptor、guard、pipe 要按职责拆分，不把业务规则塞进基础设施横切层。
- repository 返回值、错误和幂等语义必须清晰；不要把 ORM 特有异常直接裸抛到 controller。
- 需要数据库变更时，必须通过项目现有迁移机制表达；不得手工假设线上表结构。

## 评审输出

### 必须包含

1. 目标分类
2. 检查范围
3. 总结论
4. 问题列表
5. 改动建议汇总

### 每个问题都必须包含

- 编号
- 严重级别：`critical`、`major` 或 `minor`
- 规则点
- 证据：文件路径和位置
- 问题说明：说明为什么不符合当前目标，而不是只复述规则
- 改动建议：给出可直接执行的修改方向、目标文件和建议落点

### 输出约束

- 目标分类只能使用 `entrypoint`、`application-module`、`domain-module`、`infrastructure-adapter`、`shared-support` 或 `mixed-module`。
- 检查范围必须说明实际阅读的文件、目录、调用链或验证命令；未检查部分标记 `NOT RUN`。
- 总结论只能使用 `PASS`、`FAIL`、`MISSING`、`NOT RUN` 或 `N/A`。
- 不得把脚本 `PASS`、未检查项或缺少脚本写成整体 `PASS`。
- 不得只写“建议优化”“建议调整”“建议规范化”这类空泛建议。

## 完成前检查

- 模块边界是否围绕当前业务能力，而不是继续迁就旧结构。
- controller、application、domain、infrastructure 的职责是否混淆。
- DTO、`ValidationPipe`、响应序列化、构造函数注入、事务边界、错误基类和错误映射是否表达清楚。
- repository、adapter 和外部依赖是否只承担持久化/集成职责，没有越界承载业务编排。
- 共享抽离是否按领域边界判断：全局基础设施、跨域业务资产和局部业务逻辑是否分别落在对应层级，而不是机械依赖物理最近公共父级或“三次法则”。
- 是否运行了与风险匹配的现有 lint、test、build、启动验证或集成测试。

## GraphQL 场景说明

本 Skill 主要面向 REST/HTTP API 场景。NestJS GraphQL 项目可参考以下适配：

- Resolver 对应 controller 层：使用 `@Resolver`、`@Query`、`@Mutation` 装饰器，负责参数提取和响应映射。
- 输入校验：GraphQL Input Type 配合 `class-validator` 和 `ValidationPipe` 仍然有效。
- DataLoader：使用 `@nestjs/dataloader` 或手动实现，属于 infrastructure 层的数据访问优化。
- Subscription：使用 `@Subscription` 装饰器，协议适配属于 transport 层，事件产生属于 application 层。

分层原则（controller/resolver → application → domain → infrastructure）同样适用，只是入口从 `@Controller` 变为 `@Resolver`。

## 示例

### 结构示例

```text
src/modules/orders/
  orders.module.ts
  controllers/
    orders.controller.ts
    dto/
      create-order.dto.ts
      order.response.ts
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
src/shared/
  order-presenter.ts
```

### 模块装配

```ts
// 必须使用 abstract class 而非 interface，才能作为 NestJS DI token
export abstract class OrderRepository {
  abstract findById(orderId: OrderId): Promise<OrderAggregate | null>
  abstract save(order: OrderAggregate): Promise<void>
}

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

### DTO 与 ValidationPipe

```ts
export class CreateOrderDto {
  @ApiProperty({ description: '客户 ID', format: 'uuid' })
  @IsUUID()
  customerId!: string

  @ApiProperty({ description: '订单明细列表', type: () => [CreateOrderItemDto] })
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
- 启用 Swagger 时，DTO 字段同步使用 `@ApiProperty()` 或 `@ApiPropertyOptional()` 表达文档契约，不让 OpenAPI 输出退化为空字段或错误类型。
- `ValidationPipe` 统一收口边界输入校验，不把校验逻辑散落在 controller 方法体里。

### 响应序列化

```ts
@Exclude()
export class OrderResponse {
  @Expose()
  id!: string

  @Expose()
  status!: string

  @Expose()
  totalAmount!: number
}
```

```ts
app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)))
```

- 响应 DTO 使用 `class-transformer` 明确暴露字段，敏感字段默认不暴露。
- controller 返回响应 DTO 或经过 presenter 映射后的对象，不直接返回 ORM entity、聚合内部状态或第三方 SDK 原始响应。

### 应用服务与事务边界

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

### 错误与持久化封装

```ts
export abstract class BaseDomainException extends Error {
  abstract readonly code: string
}
```

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
- Service 抛出领域错误或应用错误，由 NestJS `Exception Filter` 统一转换为外部协议语义，不在业务逻辑中散落 HTTP 异常转换。
- 自定义领域错误和应用错误继承统一基类并暴露稳定错误码，Filter 只负责协议映射，不在其中堆叠每一种业务错误的类型分支。

### 测试装配

```ts
describe('CreateOrderService', () => {
  let module: TestingModule

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        CreateOrderService,
        {
          provide: OrderRepository,
          useClass: TypeormOrderRepository,
        },
      ],
    })
      .overrideProvider(OrderRepository)
      .useValue(orderRepositoryMock)
      .compile()
  })
})
```

- 单元测试与集成测试都从 `Test.createTestingModule` 开始装配，保持上下文隔离。
- Mock 优先通过 `overrideProvider` 覆写依赖，不直接 new 出整条实例化链。

### 评审输出示例

- 目标分类：`application-module`
- 检查范围：`src/modules/orders/controllers/orders.controller.ts`、`src/modules/orders/application/create-order.service.ts`、`src/modules/orders/infrastructure/persistence/typeorm-order.repository.ts`
- 总结论：`FAIL`

1. `major`
   - 规则点：controller 只处理传输层，不直接编排跨仓储流程
   - 证据：`src/modules/orders/controllers/orders.controller.ts:28`
   - 问题说明：controller 直接创建 entity、写 repository 并拼装响应，导致 HTTP 层承担了 application 和 persistence 职责。
   - 改动建议：把创建订单流程下沉到 `src/modules/orders/application/create-order.service.ts`，controller 只负责 DTO 入参、调用 service 和响应映射。

2. `critical`
   - 规则点：边界输入优先通过 `class-validator` + `ValidationPipe` 统一校验
   - 证据：`src/main.ts:14`，`src/modules/orders/controllers/dto/create-order.dto.ts:1`
   - 问题说明：应用未注册全局 `ValidationPipe`，`CreateOrderDto` 也没有字段级校验装饰器。
   - 改动建议：在 `src/main.ts` 注册 `ValidationPipe`，并为 `CreateOrderDto` 增加 `class-validator` 约束与必要的 `class-transformer` 类型转换。

3. `major`
   - 规则点：repository 只负责持久化访问，不直接暴露 ORM entity 或底层异常给 controller
   - 证据：`src/modules/orders/infrastructure/persistence/typeorm-order.repository.ts:33`
   - 问题说明：repository 将 `OrderEntity` 直接返回给 controller，且未把唯一键冲突等数据库错误转换为领域/应用语义。
   - 改动建议：在 repository 内完成 entity 到 aggregate/response model 的映射，并把数据库错误转换为显式领域错误或应用错误。

## 检查清单

1. 是否先确认了业务能力、外部契约、模块边界、事务要求、持久化模型和当前项目使用的 Nest 基础设施？
   - 未阅读时标记 `NOT RUN`，不得伪装成已完成审查。
2. 当前目标分类是否明确为 `entrypoint`、`application-module`、`domain-module`、`infrastructure-adapter`、`shared-support` 或 `mixed-module`？
   - 若分类不清，标记 `FAIL`，并说明职责为什么混杂。
3. controller 是否只处理路由、参数提取、DTO 校验和响应映射？
   - 若 controller 直接操作 repository、拼装事务或暴露 ORM 细节，标记 `FAIL`。
   - 若直接注入 `@Req()`、`@Res()` 或散落读取 `@Headers()`，优先建议改为自定义参数装饰器。
4. 边界输入是否通过 `class-validator` 和 `ValidationPipe` 表达运行时契约？
   - 若只存在 TypeScript 类型、没有运行时校验，标记 `FAIL`，指出缺失位置和建议补点。
5. provider 是否统一使用构造函数注入，没有字段注入、隐式共享状态或横向读取容器？
   - 若不符合，标记 `FAIL`，指出具体类和建议替换方式。
6. application service 是否承担用例编排与事务边界，而不是把这些职责分散在 controller、guard、interceptor 或 repository 中？
   - 若不符合，标记 `FAIL`，指出错误边界和应迁移的位置。
7. domain 是否承载核心业务规则和仓储契约，而不是依赖 Web 宿主对象、HTTP/GraphQL/Swagger 注解或 ORM 细节？
   - 若不符合，标记 `FAIL`，指出具体耦合点。
   - Domain Service 可使用 `@Injectable()` 接入 DI，但不能把传输层或持久化层注解带入 domain。
8. repository / adapter 是否只负责持久化和外部依赖访问，没有夹带 HTTP 拼装、鉴权决策或跨聚合流程？
   - 若不符合，标记 `FAIL`，指出越界逻辑和回收层次。
9. 响应输出是否通过 response DTO、`class-transformer` 和 `ClassSerializerInterceptor` 做安全序列化？
   - 若直接返回 ORM entity、领域对象内部状态或包含敏感字段的底层对象，标记 `FAIL`。
10. 启用 OpenAPI 时，DTO 和 Controller 是否使用 `@ApiProperty()`、`@ApiOperation()` 等 Swagger 装饰器同步文档契约？
    - 若生成文档缺少字段类型、描述或接口语义，标记 `FAIL`。
11. 采用 CQRS 时，是否使用 `@nestjs/cqrs` 的 `CommandHandler` / `QueryHandler` 等官方机制承载指令处理？
    - 若自行实现冗余 Bus，或只是把 DTO 命名为 Command 后透传普通 service，标记 `FAIL`。
12. 自定义领域错误和应用错误是否继承统一异常基类并暴露稳定错误码？
    - 若 Exception Filter 中枚举大量具体业务异常类型，标记 `FAIL`。
13. 数据库结构变更是否通过项目现有迁移机制表达？
   - 若缺失迁移脚本，标记 `FAIL` 或 `MISSING`，并说明原因。
14. 公共抽离是否按领域边界提升，而不是机械依据物理最近公共父级？
    - 出现 2 个明确独立使用点，或逻辑复杂到需要独立测试边界时即可拆分；全局基础设施可直接上浮，局部业务逻辑应留在当前 feature module 内。
    - 可配合 `verify-rules.mjs hoist` 做边界风险扫描；脚本 `PASS` 只代表扫描完成，`[HOIST_WARNING]` 必须人工复核，不代表实现整体通过。
15. 是否运行了与风险匹配的现有 lint、test、build、启动验证或集成测试？
    - 缺少脚本或依赖时标记 `MISSING`，未执行标记 `NOT RUN`，失败标记 `FAIL`。

## 自校验脚本

- `node scripts/verify-rules.mjs`
- `node scripts/verify-rules.mjs hoist --target src/shared/order-presenter.ts --uses src/modules/orders/controllers/orders.controller.ts src/modules/orders/application/create-order.service.ts src/modules/orders/infrastructure/persistence/typeorm-order.repository.ts`
