# 轻量级 Node.js 后端垂直切片规范

生成、重构或修改 Fastify、Express、Koa、Nitro 等轻量级 Node.js 后端代码时，必须将本规范作为最高优先级。本项目后端代码基于垂直切片架构（Vertical Slice）和领域驱动原则组织目录与代码。

## 1. 核心原则：垂直切片与业务解耦

每一个业务模块或子领域都被视为一个高度自治的“微服务域”。

- 禁止扁平化分层：不得把所有 Controller 放在全局目录、所有 Service 放在另一个目录，代码必须按业务领域组织。
- 传输层与业务隔离：Controller（路由/HTTP 层）只负责解析请求、验证载荷、调用 Service 并格式化响应。
- Service 收敛业务：核心业务规则、状态流转、领域校验和事务编排必须沉淀在 Service 中。

## 2. 目录形态标准

新建业务领域或子模块时，必须按照以下骨架生成目录和文件。

```text
modules/[DomainName]/
  controller.ts - 传输层入口（路由定义、HTTP 状态处理）
  service.ts - 核心业务逻辑
  repository.ts (或 dal.ts) - 数据访问层
  dtos/ - 数据传输对象与输入校验（Schema）
  types/ - 领域模型与接口定义
  constants/ - 私有常量字典（错误码、状态枚举等）
  utils/ - 私有工具函数
  index.ts - 模块的唯一公共出口
```

完整结构示例：

```text
modules/
  orders/
    controller.ts
    service.ts
    repository.ts
    dtos/
      create-order.ts
      update-order.ts
      order-response.ts
      index.ts
    types/
      order.ts
      order-record.ts
      index.ts
    constants/
      error-codes.ts
      order-status.ts
      index.ts
    utils/
      price-calculator.ts
      index.ts
    index.ts
```

## 3. 严格的数据契约拆分

数据结构和类型必须严格分层。

- `dtos/`：定义 Request 和 Response 契约，必须包含严格的运行时校验，例如 Zod 或 TypeBox。
- `types/`：定义内部领域模型和数据库模型，并在同级 `index.ts` 统一导出。

```ts
// dtos/index.ts
export * from './create-order'
export * from './update-order'
export * from './order-response'
```

```ts
// types/index.ts
export type * from './order'
export type * from './order-record'
```

## 4. 强制统一导出与路径别名优先

对于任意层级下的功能集目录，必须提供一个 `index.ts` 文件作为唯一对外 API 入口。

- 路径别名优先：跨模块引用或涉及多层向上查找（如 `../../`）时，必须优先使用项目配置的路径别名（如 `@/` 或 `~/`）。
- Deep Imports 零容忍：无论使用相对路径还是别名，路径必须且只能止步于该资源所在的根目录名称（默认命中 `index.ts`）。
- 私有数据保护：绝不允许暴露或穿透引用内部的 Repository 或底层数据结构。

禁止生成：

```ts
import { OrderService } from '../../orders/service'
import { OrderService } from '@/modules/orders/service'
```

必须生成：

```ts
import { OrderService } from '@/modules/orders'
```

## 5. 高内聚、三次原则与逐级上浮

工具函数、中间件和类型默认属于该领域的私有财产，必须遵循“严格阈值”与“拒绝越级”的抽离规则。

- 优先局部闭环：只服务于当前模块的校验逻辑、格式化方法，必须写在当前模块的 `utils/` 中。
- 严格重构三次原则（Strict Rule of Three）：绝对禁止过早抽象！只有当明确发现某段逻辑在至少 3 个独立的地方重复时，才允许触发抽离重构。
- 逐级提取至最近公共父级（Nearest Common Ancestor）：触发“三次原则”后，必须将代码提取到这 3 个调用者的“最近公共父级目录”下。
- 全局门槛：只有当不同的顶级业务域（如 `orders` 和 `users`）同时需要该逻辑（且满足三次原则）时，才允许将其上浮进入 `src/common/` 或 `src/utils/` 全局目录。

示例：如果 `orders/create`、`orders/update` 和 `orders/delete` 子模块共享了某段价格计算逻辑，该逻辑必须提取到 `orders/utils/`，绝对禁止越权直接提取到全局 `src/utils/`。

## 6. 注释与代码解释规范

- 强制 JSDoc 契约：Service 层的公共方法和暴露给外部的 DTO 必须使用 JSDoc 详细标注参数说明、返回值、以及可能抛出的业务异常（Throws）。
- Why over What：核心业务代码必须注释业务规则和边界条件，例如 `// 防止超卖：利用数据库行锁确保库存扣减的原子性`。
- 禁止翻译代码：不得编写 `// 查询数据库` 这类只复述代码行为的无效注释。

## 7. 依赖流向限制

- 自上而下：父级模块只能导入其内部子目录的内容。
- 禁止同级跨域私有访问：模块 A 严禁直接导入模块 B 内部未在 `index.ts` 中暴露的私有文件。
- 复用触发上浮：若需复用其他模块的私有逻辑，必须向上游触发“逐级上浮”重构。

## 8. AI 执行验证检查清单

在每次输出文件路径或生成代码前，必须在内心执行以下自检，不输出自检过程。

1. 业务逻辑是否完全收敛在 Service 中，Controller 是否足够薄？
2. 我是否优先使用了路径别名（`@/` 或 `~/`）？`import` 语句是否全部指向了目标的 `index.ts`，没有发生跨模块的深层穿透引用？
3. 我是否严格遵守了“三次原则”？在没有 3 处以上调用的情况下，是否克制住了提取全局代码的冲动？
4. 触发抽离时，我是否精确地将其提取到了“最近的公共父级”目录，而不是错误地一步登天塞进全局？
5. 暴露给外部调用的 Service 方法是否具备完整的 JSDoc 和异常说明？
