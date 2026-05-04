# Common 代码风格

## 目录结构 — 按功能模块

```
src/
├── api/              # 接口调用
├── components/       # 全局通用组件
├── composables/      # 全局逻辑复用
├── modules/          # 业务模块
├── router/           # 路由
├── stores/           # 状态管理
├── styles/           # 全局样式
├── types/            # 全局类型
├── utils/            # 工具函数
└── app.vue / app.tsx
```

## 目录命名 — 除组件外，一律小驼峰

| 类型 | 规则 | 示例 |
|---|---|---|
| 组件目录 | PascalCase | `FormDrawer`、`DetailDrawer` |
| 其他目录 | 小驼峰 | `userManagement`、`orderManage`、`api`、`composables` |

```
src/
├── userManagement/          ✅ 小驼峰
│   └── orderList/           ✅ 小驼峰
├── components/              ✅ 小驼峰
├── composables/             ✅ 小驼峰

// ❌ 错误
├── user-management/         ❌ kebab-case
├── UserManagement/          ❌ 大驼峰
```

## 功能内聚 — 相关文件就近存放

**原则**: 一个功能相关的**所有文件**（子组件、composable、types、constants 等）除非跨功能共享，否则放在同一个目录下：

```
xx组件/
├── README.md                        # 描述文件，提供组件用法等
├── index.ts                         # 入口文件，提供组件注册函数等
└── src/
  ├── types/                         # 组件类型
  ├── composables/                   # 组件hooks
  ├── constants/                     # 组件常量
  ├── index.vue / index.tsx          # 组件主文件
  └── components/                    # 组件相关组件
    └── AuditDialog/                 ✅ AuditDialog 功能内聚
        ├── types/
        ├── components/
        ├── composables/
        ├── constants/
        └── index.vue
```

```
xx页面/
├── index.vue                        # 页面主文件
├── types/                           # 页面类型
├── constants/                       # 页面常量
├── composables/                     # 页面hooks
└── components/                      # 页面相关组件
    └── AuditDialog/                 ✅ AuditDialog 功能内聚
        ├── types/
        ├── components/
        ├── composables/
        ├── constants/
        └── index.vue
```



## 注释

**目标**

注释用于帮助读者在不深入追踪上下文的情况下快速识别代码作用、边界和约束。函数注释默认全覆盖，但注释内容必须提供有效信息，不允许用空泛句子凑覆盖率。

注释语言必须跟随用户本次需求或项目既有主要语言；若用户明确指定语言，以指定语言为准。命令、代码标识符、日志原文、错误原文、API/库名和专有名词可保留原文。

**必须注释**

- 页面、模块、组件、composable、store、复杂配置对象的整体职责。
- 所有函数默认必须注释，说明其职责、边界、输入输出约束、副作用或异常语义。
- 导出 API、跨文件复用函数、业务规则函数、composable/hook、事件处理函数、异步流程函数的用途、关键输入输出和副作用。
- 业务规则、边界条件、兼容性处理、性能约束、异步时序、安全限制和历史原因。

**不应注释**

- 命名、类型和局部上下文已经能清晰表达含义的字段、变量。
- 仅复述代码行为的注释，例如"设置 loading 为 true""处理点击事件"。

**可免注释的函数**

- 极简单的局部回调，例如 `items.map(item => item.id)` 这类无业务语义的表达式函数。
- 测试中的短小内联函数，且测试名称、断言和上下文已经完整表达意图。
- 上下文已完整表达含义的短小私有函数；若读者需要跨文件或跨模块追踪才能理解，则不得免注释。

**函数注释 — 默认全覆盖，导出函数优先使用 JSDoc**

```ts
/**
 * 创建订单列表查询的默认参数。
 *
 * 默认值只包含所有查询场景共享的分页字段，筛选条件由调用方按需传入。
 */
export function createDefaultOrderQuery() { }
```

**文件内私有函数 — 可用短注释，但必须说明职责或约束**

```ts
// 只归一化前端表单态，不兼容后端历史字段。
function normalizeSearchForm() { }
```

**复杂类型 / 字段分组 — 先说明整体，必要时补充字段约束**

```ts
/**
 * 用户详情展示记录，字段直接对齐后端用户详情接口。
 */
interface UserRecord {
  userId: number
  userName: string
  createdAt: string
  updatedAt: string
}
```

**字段单独注释 — 仅在无法通过命名和类型快速识别时使用**

```ts
interface RetryPolicy {
  /** 单位为 ms，必须小于后端熔断窗口。 */
  retryDelay: number
  maxAttempts: number
}
```

**常量 — 说明来源、限制或业务含义**

```ts
/**
 * 订单列表默认每页条数，需与后端分页上限保持一致。
 */
export const DEFAULT_PAGE_SIZE = 10
```

---

## 工具函数抽离原则

**只在真正多文件复用时才抽离为独立文件**，否则内联到使用处：

**判断标准**：
- 只有 1 个文件使用 → 内联到该文件
- 2-3 个文件使用 → 考虑抽离
- 4+ 个文件使用 → 必须抽离

---

## 参数传递原则

**按需传递参数，不同查询场景传递不同参数**，不在默认参数中统一设置：

**原则**：
- 默认参数只包含所有查询都需要的字段（如 `currentPage`、`pageSize`）
- 特定查询的特殊参数在调用时单独传递
- 避免"一刀切"的默认参数设计

---

## 接口对齐原则

**前端代码严格对齐后端接口定义**：
- 不添加接口不存在的字段
- 不臆造接口不返回的逻辑（如"加载更多"行）
- 发现接口变更后，及时移除前端冗余代码
- 前端状态管理以接口返回为准，不做过度设计

```ts
// ✅ 好：严格对齐接口
interface ApiRecord {
  id: number
  name: string
  hasChildren: boolean
}

// ❌ 差：臆造接口不存在的逻辑
type TableRow = ApiRecord | LoadMoreRow // 接口不返回 loadMore 行
```

---

## TypeScript 优先原则

**优先使用 TypeScript 类型系统，减少运行时防御式检查**：

```ts
// ✅ 好：依赖类型系统
const name: string = record.name
const page: number = payload.currentPage ?? 1

// ❌ 差：运行时防御式检查（除非必要）
const name = normalizeString(record.name) || ''
const page = normalizeNumber(payload.pageNum) || 1
```

**原则**：
- 类型定义清晰时，直接使用值，不需要运行时检查
- 只在外部数据（如用户输入、第三方 API）需要防御式检查
- 避免对内部数据做不必要的 normalize

---

## 字段统一原则

**统一字段命名，避免冗余兼容**：

```ts
// ✅ 好：统一使用一个字段
const page = payload.currentPage ?? 1

// ❌ 差：兼容多个字段，增加维护成本
const page = payload.pageNum ?? payload.currentPage ?? 1
```

**原则**：
- 确定一个标准字段名，全项目统一使用
- 移除历史兼容代码，保持代码简洁
- 如接口字段变更，统一更新前端代码，不做兼容处理
