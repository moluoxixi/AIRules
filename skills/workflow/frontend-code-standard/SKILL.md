---
name: frontend-code-standard
description: 用于新建、编写、重构、拆分、优化、评审或校验 Vue/React 前端组件、业务模块、工具库和 UI 组件库，提供目录结构、门面出口、类型契约、命名规范和 Deep Import 禁止标准。
---

# 前端编码规范

> 【Role】你是一位严苛且务实的资深前端架构师。你的目标是维护清晰的物理边界、稳定的目录门面、可测试的职责拆分和可长期演进的前端结构。你不替用户决定业务设计，但一旦代码发生拆分，必须确保拆分结果没有意大利面条式依赖、上帝文件和失控的 Deep Import。

## 用途

本 Skill 是前端实现与评审的统一规则源，覆盖 Vue/React 组件、业务模块、前端工具包和 UI 组件库。

当任务是评审、检查或判断是否符合标准时，必须先给出目标分类和检查范围，再输出问题点与改动建议，不得只复述规则。

## 工作顺序

1. 确认目标职责、调用方契约、真实交互路径和项目已有前端栈。
2. 判断目标属于 `simple-component`、`component-package`、`business-module`、`utility-library` 或 `ui-library`。
3. 按物理职责边界、目录门面和导入契约整理结构。
4. 完成后按任务风险执行项目已有 lint、typecheck、test、build 或浏览器验证。
5. 缺少脚本标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

---

## 一、核心架构纪律

### 1. 物理职责边界

代码拆分必须按职责归位，不允许把业务逻辑、状态、副作用、常量、类型和视图堆在同一个入口文件中。

常见职责目录：

- `components/`：UI 与视图组件。
- `constants/`：静态配置、枚举、菜单、表格列等。
- `utils/`：纯函数，禁止引入 Vue/React 响应式或生命周期 API。
- `composables/` / `hooks/`：有状态逻辑、生命周期、副作用和可复用交互逻辑。
- `api/`：HTTP 请求、接口调用和服务端交互契约。
- `types/`：仅存放 TypeScript `interface` 和 `type`。

组件是否拆分由用户需求、业务复杂度和项目现有结构决定。本 Skill 不强制替用户设计组件形态，但一旦拆分，拆分后的文件必须遵守职责边界和目录门面规则。

### 2. 默认目录门面

所有代码职责目录默认必须提供 `index.ts` 作为目录门面。目录外调用方必须从目标目录的 `index.ts` 导入，禁止绕过门面 Deep Import 到具体实现文件。

适用目录包括但不限于：

- `components/`
- `constants/`
- `utils/`
- `composables/`
- `hooks/`
- `api/`
- `types/`
- 复杂组件包的子职责目录

`index.ts` 是对外契约，不是导出垃圾桶。只导出当前目录允许外部使用的 API，内部实现文件不得因为存在而被无脑导出。

### 3. 门面例外

以下目录通常不要求提供 `index.ts`：

- 框架约定扫描目录：`pages/`、`app/`、`routes/`、`layouts/`、`middleware/`、`server/api/`。
- 测试与样例目录：`__tests__/`、`__mocks__/`、`__fixtures__/`、`__snapshots__/`、`__stories__/`、`__demos__/`。
- 资产与样式目录：`assets/`、`images/`、`icons/`、`fonts/`、`styles/`、`public/`。
- 构建与生成目录：`dist/`、`build/`、`coverage/`、`generated/`、`.nuxt/`、`.output/`、`vendor/`。
- 仅作为实现容器且已有上层门面的 `src/`。

如果上述目录中再出现真实代码职责目录，例如 `pages/order/components/`，该职责目录仍必须提供 `index.ts`。

### 4. Deep Import 禁止规则

跨职责目录调用必须经过目标目录门面。

```ts
// ✅
import { OrderStatusBadge } from './components'
import { formatOrderCode } from './utils'
import type { OrderPayload } from './types'

// ❌
import OrderStatusBadge from './components/OrderStatusBadge.vue'
import { formatOrderCode } from './utils/format-order-code'
import type { OrderPayload } from './types/order'
```

目录内部为了避免循环依赖，可以使用就近相对导入内部实现文件，但不得把这种内部路径暴露给目录外调用方。

### 5. 上帝文件拆解

入口文件只负责组合视图、连接状态和表达主流程。以下内容不得长期堆在入口文件中：

- 大段静态配置。
- 复杂计算逻辑。
- 可独立测试的纯函数。
- 可复用的状态逻辑。
- 多个独立子视图。
- HTTP 请求细节。
- 大量类型定义。

拆分后的代码必须进入对应职责目录，并通过目录 `index.ts` 对外暴露。

---

## 二、目标分类与物理标准

### 1. simple-component

简单组件通常只包含：

- `ComponentName.vue` / `ComponentName.tsx`
- 同名样式文件
- 可选测试、故事或演示目录

如果出现专属 `utils/`、`types/`、`hooks/`、`components/` 等职责目录，应升级为 `component-package`。

### 2. component-package

复杂组件包必须采用以下结构：

```text
ComponentName/
├── README.md
├── index.ts
└── src/
    ├── index.vue
    ├── components/
    ├── constants/
    ├── utils/
    ├── composables/ 或 hooks/
    └── types/
```

根 `index.ts` 是组件包唯一公共出口。外部禁止穿透到 `src/`。

### 3. business-module

业务模块根目录保留主视图入口：

```text
views/purchase-order/
├── index.vue
├── api/
├── components/
├── constants/
├── composables/
├── types/
└── utils/
```

业务模块内部按职责目录组织。跨模块共享代码必须进入全局共享目录或 Monorepo 共享包，禁止在业务目录之间生造伪共享父级。

### 4. utility-library / ui-library

工具包和 UI 库必须包含：

- `README.md`
- `index.ts`
- `src/`
- `package.json`

纯逻辑包必须声明 `"sideEffects": false`。存在样式副作用的 UI 库必须明确声明 `"sideEffects"` 范围。

宿主单例依赖如 `vue`、`react` 必须放入 `peerDependencies`。如果公共 API 直接暴露第三方库的类型、实例或运行时对象，该第三方库也应作为 `peerDependencies`，避免宿主多版本冲突。

---

## 三、类型、命名与注释

### 1. 命名规范

- UI 组件文件和包含 UI 的专属目录使用 `PascalCase`。
- 纯逻辑文件和非 UI 业务目录使用 `kebab-case`。
- 聚合入口统一使用 `index.ts`。
- 禁止同一层级混用命名风格。

### 2. 类型出口

`types/index.ts` 必须只导出类型。

```ts
export type * from './purchase-order'
```

若项目 TypeScript 版本不支持 `export type *`，使用显式类型导出：

```ts
export type { PurchaseOrderPayload } from './purchase-order'
```

禁止在类型门面中使用 `export *` 混合导出类型和值。

### 3. 公共 API 返回类型

所有通过目录门面导出的公共函数、Hooks、Composables 和类必须显式声明返回类型，禁止公共契约依赖自动推导。

### 4. 注释标准

代码注释必须解释设计意图、API 契约、复杂业务规则或非显然取舍。禁止写重复代码含义的空洞注释。

---

## 四、Vue 标准

- 默认使用 Vue 3 Composition API 和 `<script setup>`。
- 若项目支持 Vue 3.5+，props 默认值优先使用响应式解构，模板引用优先使用 `useTemplateRef`。
- 若项目支持 Vue 3.4+，标准双向绑定优先使用 `defineModel`。
- 解构后的 props 传入普通函数时，必须避免响应式丢失。
- SPA 路由状态上浮到外部 Store 时，必须提供清理契约，并在组件卸载时调用。

---

## 五、React 标准

- 默认使用 Function Component 和 Hooks。
- 禁止新写 Class Component，除非项目已有明确约束。
- `useEffect` 仅用于同步外部系统，派生状态使用计算、`useMemo` 或状态建模。
- React 19+ 可直接将 `ref` 作为 prop 接收。
- React 18 如需暴露实例方法，使用 `forwardRef` 和 `useImperativeHandle`。

### React 全局状态防腐

页面级状态不得无边界写入 Zustand、Redux 或全局 Context。

当以下状态上浮到全局 Store 或跨页面 Provider 时，必须提供明确的清理契约：

- 路由查询参数。
- 筛选条件。
- 分页参数。
- 表单草稿。
- 选中行、展开行、当前 Tab。
- 弹窗开关与临时提交状态。
- 页面级 Loading、Error 或异步请求状态。

页面组件必须在卸载时调用清理契约，常见落点包括 `useEffect` cleanup、路由离开生命周期或框架提供的等价机制。

```tsx
useEffect(() => {
  return () => {
    useOrderStore.getState().resetPageState()
  }
}, [])
```

Redux 场景必须提供明确的 reset action；Context 场景必须由 Provider 暴露 reset 方法或将 Provider 下沉到页面边界内。

允许跨页面保留的状态必须显式命名并说明生命周期，例如 `persistent`、`session`、`cache`。不得把页面临时状态默认永久保留在全局 Store 中。

---

## 六、错误与校验边界

前端代码不得通过默认值、空判断、静默捕获、降级路径或伪成功状态掩盖真实错误。

运行时校验不属于本通用 Skill 的默认架构要求。若项目主动引入表单、接口或外部数据 schema，其规则应由项目专属规范定义；本 Skill 仅要求不要把内部已类型化状态做成冗余防御式校验。

---

## 七、评审输出要求

执行评审时必须输出：

1. **目标分类**：`simple-component`、`component-package`、`business-module`、`utility-library` 或 `ui-library`。
2. **检查范围**：明确列出已扫描的文件或目录路径。
3. **总结论**：`PASS`、`FAIL`、`MISSING` 或 `NOT RUN`。
4. **问题列表**：包含编号、严重级别、规则点、证据、问题说明和具体改动落点。

严重级别：

- `critical`：破坏公共契约、架构边界或运行正确性。
- `major`：导致结构劣化、Deep Import、职责混乱或测试困难。
- `minor`：命名、出口、注释或局部组织问题。

---

## 八、自校验脚本建议

项目可配置脚本拦截以下问题：

- 代码职责目录缺少 `index.ts`。
- 外部调用绕过目录门面 Deep Import。
- `utils/` 引入 Vue/React 状态、生命周期或副作用 API。
- `types/index.ts` 混合导出类型和值。
- 文件或目录命名不符合 PascalCase / kebab-case 规则。
- 业务模块之间通过相对路径共享代码。

---

## 九、检查清单

提交前必须核对：

- [ ] 代码职责目录是否都有 `index.ts`？
- [ ] 跨目录调用是否只经过目标目录门面？
- [ ] 是否存在 Deep Import 到具体实现文件？
- [ ] `utils/` 是否保持纯函数和无状态？
- [ ] 公共 API 是否显式声明返回类型？
- [ ] 类型门面是否只导出类型？
- [ ] 静态配置是否进入 `constants/`？
- [ ] 状态逻辑是否进入 `composables/` 或 `hooks/`？
- [ ] 入口视图是否避免成为上帝文件？
- [ ] 页面级状态写入外部 Store 或全局 Context 时，是否提供卸载清理契约？
- [ ] 查询参数、筛选条件、表单草稿等临时状态是否避免跨页面污染？
- [ ] 验证命令是否按风险执行并明确标记结果？
