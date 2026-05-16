# Vue 3 / React TypeScript / JavaScript 分形前端规范

生成、重构或修改 Vue 3 或 React TypeScript / JavaScript 代码时，必须将本规范作为最高优先级。本项目基于分形架构（Fractal Architecture）和特性驱动（Feature-Driven）组织目录与代码。

## 1. 核心原则：分形递归与就近原则

每一个复杂组件或业务模块都被视为一个高度自治的“微型应用”。

- 逻辑与 UI 分离：倡导 Headless 模式，核心业务状态和交互逻辑必须从视图层中剥离。
- 禁止扁平化：不得将模块专用的类型、工具类或状态逻辑盲目提升到全局（`src/types`、`src/utils`）。
- 递归结构：组件内部的子组件必须拥有与父级完全一致的目录层级能力，包含自己的私有作用域。

## 2. 目录形态标准

创建新的业务视图或复杂组件时，参考以下骨架生成目录（**除入口文件外，其余子目录均为按需创建，严禁创建无意义的空目录**）：

```text
[ModuleName]/
  index.vue (或 index.tsx / index.jsx) - [必填] UI 视图/组件入口，仅负责渲染和组装
  api/ - [可选] 仅限本模块调用的接口定义
  components/ - [可选] 模块私有子组件（可继续递归此结构）
  composables/ (Vue) 或 hooks/ (React) - [可选] 模块私有状态与无头业务逻辑
  constants/ - [可选] 模块私有常量字典
  styles/ - [可选] 模块私有样式文件
  types/ - [可选] 模块私有类型定义
  utils/ - [可选] 模块私有纯函数与工具
  index.ts 或 index.js - [必填] 模块的唯一公共出口
```

完整结构示例：

```text
views/
  purchaseOrder/
    index.vue
    api/
      index.ts
    components/
      index.ts
      AuditDialog/
        index.vue
        api/
          index.ts
        components/
          index.ts
        composables/
          index.ts
        constants/
          index.ts
        types/
          props.ts
          emit.ts
          expose.ts
          index.ts
        utils/
          index.ts
        index.ts
    composables/
      index.ts
    constants/
      index.ts
    types/
      index.ts
    utils/
      index.ts
    index.ts
```

React 模块使用同一结构，将 `index.vue` 替换为 `index.tsx` 或 `index.jsx`，将 `composables/` 替换为 `hooks/`。

单个业务模块直接在根目录组织，不再额外创建 `src/`；只有组件包或项目级封装才使用 `src/` 作为实现目录。

组件包或复杂组件目录必须使用独立组件包结构，组件根目录只承载使用说明与公共出口，真实实现必须放入 `src/`：

```text
DataTable/
  README.md - [必填] 描述组件用途、使用方式和 Props/Events/Expose/Slots 等接口契约
  index.ts 或 index.js - [必填] 组件包唯一公共出口
  src/ - [必填] 组件真实实现目录
    index.vue (或 index.tsx / index.jsx)
    types/
      props.ts
      expose.ts (或 ref.ts)
      emit.ts
      index.ts
```

外部消费者只能从组件根目录的 `index.ts` 或 `index.js` 导入，禁止穿透 `src/` 引用组件内部实现。

## 3. 组件类型细粒度拆分规则

类型定义必须从视图文件中彻底抽离，在 `types/` 目录下进行严格切割。

- `props.ts`：仅定义组件的入参 Props 接口。
- `expose.ts`（或 `ref.ts`）：仅定义组件对外暴露的实例方法与属性接口。
- `emit.ts`：仅限 Vue，定义组件 Emits 事件接口。
- `index.ts`：必须通过此文件统一导出上述所有类型。

> **粒度豁免（逃生舱原则）**：对于代码量极少、无状态逻辑的纯展示型原子组件（如简单按钮），允许直接在 `index.vue` / `index.tsx` 中内联定义 Props 和类型。只有当组件包含内部状态、复杂交互或暴露实例方法时，才强制拆分 `types/` 目录，防止过度工程化。

```text
AuditDialog/
  index.vue
  types/
    props.ts
    emit.ts
    expose.ts
    index.ts
```

```text
DataTable/
  index.tsx
  types/
    props.ts
    ref.ts
    index.ts
```

```ts
// Vue types/index.ts
export type * from './props'
export type * from './expose'
export type * from './emit'
```

```ts
// React types/index.ts
export type * from './props'
export type * from './ref'
```

## 4. 强制统一导出与路径别名优先

对于任意层级下的功能集目录，必须提供一个 `index.ts` 或 `index.js` 文件作为唯一对外 API 入口。

- 路径别名优先：跨模块引用或涉及多层向上查找（如 `../../`）时，必须优先使用项目配置的路径别名（如 `@/`）。
- Deep Imports 零容忍：无论使用相对路径还是别名，路径必须且只能止步于该资源所在的根目录名称（默认命中 `index.ts` 或 `index.js`）。绝对禁止穿透目录直接引用具体文件。

禁止生成：

```ts
import { formatDate } from '../../utils/date'
import { formatDate } from '@/components/DataTable/utils/date'
```

必须生成：

```ts
import { formatDate } from '@/components/DataTable/utils'
```

## 5. 高内聚、三次原则与逐级上浮

业务逻辑默认属于私有财产，必须遵循“严格阈值”与“拒绝越级”的抽离规则。

- 状态局部闭环：新逻辑首选写在当前组件的 `composables/` 或 `hooks/` 中。
- 严格重构三次原则（Strict Rule of Three）：绝对禁止过早抽象！只有当明确发现某段逻辑或组件在至少 3 个独立的地方重复时，才允许触发抽离重构。
- 逐级提取至最近公共父级（Nearest Common Ancestor）：触发“三次原则”后，必须将代码提取到这 3 个调用者的“最近公共父级目录”下。
- 全局门槛：只有当不同的顶级业务域同时需要该逻辑（且满足三次原则）时，才允许进入 `src/` 根级别的公共目录。

示例：A、B、C 组件共用逻辑，若它们的最近父级是 `purchaseOrder` 模块，则提取到 `purchaseOrder/utils/`，绝对禁止越权直接提取到全局 `src/utils/`。

## 6. 注释与代码解释规范

- 强制 JSDoc 契约：核心契约（`props`、`expose`）及公用 `utils` 必须使用 JSDoc 标注字段含义和默认值，保障编辑器提示。
- Why over What：在业务逻辑中，必须解释业务意图或架构设计（如 `// 初始化底层配置以驱动动态表单渲染`），禁止生成翻译代码的无用注释。
- 标注复杂副作用：使用 `watch`、`watchEffect` 或 `useEffect`、`useMemo` 等响应式/副作用钩子时，必须明确注释其监听的依赖变化原因、副作用目标以及潜在的闭包边界情况。

## 7. 样式隔离与约束

- 局部作用域：若项目使用独立样式文件，可建立 `styles/` 目录或使用 `xxx.module.scss`；若使用 TailwindCSS 等 Utility 框架，需保持 class 排序清晰。
- 严禁污染全局：组件样式必须严格限定在组件私有作用域内，严禁跨组件层叠污染其他模块。

## 8. 依赖流向限制

- 自上而下：父级模块只能导入其内部子目录的内容。
- 禁止同级跨域：模块 A 严禁直接导入模块 B 内部的私有文件。若需复用，必须向上游触发“逐级上浮”重构。

## 9. AI 执行验证检查清单

在每次生成代码或修改文件前，必须在内心执行以下自检，不输出自检过程。

1. 复杂组件的接口定义是否按照 `props`、`expose` 拆分并由 `types/index.ts` 导出了？
2. 我是否优先使用了路径别名（`@/`）？`import` 语句是否全部指向了目标的 `index.ts` 或 `index.js`，没有发生穿透？
3. 我是否严格遵守了“三次原则”？在没有 3 处以上调用的情况下，我是否克制住了抽离公共代码的冲动？
4. 触发抽离时，我是否精确地将其提取到了“最近的公共父级”目录，而不是错误地塞进全局 `src/`？
5. 涉及依赖数组/响应式追踪的复杂副作用是否添加了“Why over What”级别的高质量注释？
