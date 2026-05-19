# NestJS 后端领域模块规范

生成、重构或修改 NestJS 代码时，必须将本规范作为最高优先级。本项目 NestJS 后端代码基于领域驱动模块化（DDD-lite）、严格依赖注入（DI）和桶模式（Barrel Pattern）组织目录与代码。

## 1. 核心原则：领域模块化与边界

每一个业务特性（如 `src/modules/orders`）必须是一个独立的、自治的 Nest `@Module()`。

- 业务解耦：Controller 必须极度轻量，仅负责路由分发、参数接收与 DTO 校验。
- Service 收敛业务：所有核心业务规则、事务控制和状态流转必须沉淀在 Service 中。
- DI 隔离：禁止跨模块直接实例化类。模块 A 严禁直接通过路径导入并调用模块 B 的 Service；必须在 B 的 `@Module({ exports: [BService] })` 中暴露，并在 A 中 `imports: [BModule]`，最后通过构造函数安全注入。

## 2. 目录形态标准

新建业务模块时，必须按照垂直切片生成目录和文件。

```text
src/modules/[feature-name]/
  [feature].controller.ts - 路由与 HTTP 层
  [feature].service.ts - 核心业务逻辑
  [feature].module.ts - 模块 DI 组装与边界定义
  dto/ - 带有 class-validator 装饰器的验证契约
  entities/ (或 schemas/) - 数据库 ORM 模型
  constants/ - 私有常量字典（错误码、状态枚举等）
  interfaces/ - 模块私有 TS 类型定义
  utils/ - 私有纯函数与 Helper（无需 DI 的静态方法）
  index.ts - 模块的唯一公共出口（导出 Module 和公用 DTO）
```

完整结构示例：

```text
src/modules/orders/
  orders.controller.ts
  orders.service.ts
  orders.module.ts
  dto/
    create-order.dto.ts
    update-order.dto.ts
    index.ts
  entities/
    order.entity.ts
    index.ts
  constants/
    order-status.ts
    index.ts
  interfaces/
    order-summary.interface.ts
    index.ts
  utils/
    price-calculator.ts
    index.ts
  index.ts
```

## 3. 强类型的 DTO 与校验契约

- 严禁在 Controller 中使用 `any` 或松散的 `interface` 接收请求数据。
- 输入数据必须使用 `class`，并强制结合 `class-validator` 装饰器（如 `@IsString()`、`@IsNotEmpty()`）进行严格校验。
- 如项目使用 `@nestjs/swagger`，DTO 必须同步补充 Swagger 装饰器，确保 API 文档与运行时校验契约一致。

```ts
// dto/index.ts
export * from './create-order.dto'
export * from './update-order.dto'
```

## 4. 公共入口与路径别名优先

业务模块或需要形成稳定公共 API 的功能集目录，必须提供 `index.ts` 文件作为对外入口。模块私有的 `dto/`、`utils/`、`constants/` 不因目录存在而强制创建 barrel；只有被模块入口公开消费时，才建立明确的 public surface。

- 路径别名优先：跨模块引用或涉及多层向上查找时，必须优先使用项目配置的路径别名（如 `@/` 或 `src/`）。
- Deep Imports 零容忍：模块间引用必须止步于目标模块公共入口；模块内部文件之间可按就近原则引用私有文件，但不得绕过模块入口访问其他模块内部结构。
- 模块边界双重暴露：跨模块使用 Service 时，目标模块必须同时通过 `index.ts` 和 `@Module({ exports: [...] })` 暴露公共能力。

禁止生成：

```ts
import { CreateOrderDto } from '../../orders/dto/create-order.dto'
import { OrdersModule } from '@/modules/orders/orders.module'
```

必须生成：

```ts
import { OrdersModule, CreateOrderDto } from '@/modules/orders'
```

## 5. 高内聚、三次原则与逐级上浮

自定义 Guard、Interceptor、Pipe 和工具函数默认属于该领域的私有财产，必须遵循按需上浮、拒绝越级的规则。

- 优先局部闭环：新编写的 Pipe 或 Helper 优先写在当前模块自身目录下，如 `modules/orders/pipes/`。
- 严格重构三次原则（Strict Rule of Three）：绝对禁止过早抽象！只有当明确发现某个类或逻辑在至少 3 个独立的地方重复时，才允许触发抽离重构。
- 逐级提取至最近公共父级（Nearest Common Ancestor）：触发“三次原则”后，必须将代码提取到这 3 个调用者的“最近公共父级目录”下。
- 全局门槛：只有当不同的顶级业务 `@Module`（如 `orders` 和 `users`）同时需要该 Guard 或 Utils（且满足三次原则）时，才允许上浮进入全局的 `src/common/` 目录。

示例：如果 `orders` 下的多个子级 Service 使用同一个价格计算逻辑，必须提取到 `orders/utils/`，绝对禁止越权直接提取到全局。

## 6. 注释与异常处理规范

- 强制 JSDoc 契约：Service 层的类方法必须包含 JSDoc 注释，详细标注参数、返回值和设计意图。
- Why over What：注释必须解释复杂的业务规则，严禁翻译代码；禁止编写 `// 保存到数据库` 这类无效注释。
- 标准异常边界：Service 层优先抛出领域错误或应用错误，保持业务语义不绑定 HTTP；Controller、Filter 或全局异常过滤器负责映射为 `HttpException`、`Problem Details` 或项目统一错误响应。
- Controller 保持干净：Controller 层无需手动 `try-catch` 可由 Nest 异常过滤链处理的错误；若捕获错误，只能补充上下文、转换为等价失败语义或清理资源，并继续抛出。

## 7. 依赖流向限制

- 自上而下：父级模块只能导入其内部子目录的内容。
- 禁止同级跨域私有访问：模块 A 严禁导入模块 B 内部未在 `index.ts` 和 `@Module({ exports: [...] })` 中双重暴露的私有文件或 Service。
- 禁止绕过 DI：跨模块协作必须通过 `imports`、`exports` 和构造函数注入完成，不得 `new Service()` 或直接调用对方私有实例。

## 8. AI 执行验证检查清单

在每次输出文件路径或生成代码前，必须在内心执行以下自检，不输出自检过程。

1. 业务逻辑是否完全收敛在 Service 中，Controller 是否足够薄且仅做路由/校验？
2. 跨模块调用时，我是否正确使用了 `@Module` 的 `imports` 和构造函数 DI 注入，而不是违规 `new Service()`？
3. 我是否优先使用了路径别名（`@/`）？`import` 语句是否全部指向了目标的 `index.ts`，没有深层穿透？
4. 我是否严格遵守了“三次原则”？在没有 3 处以上调用的情况下，是否克制住了抽离代码的冲动？
5. 触发抽离时，我是否精确地将其提取到了“最近的公共父级”目录，而不是错误地一步登天塞进 `src/common/`？
6. DTO 是否使用了 `class-validator` 装饰器？Service 抛出的错误是否保持领域语义，并由过滤器统一映射 HTTP 响应？
