# Vue 3 / React TypeScript / JavaScript 分形前端规范

生成、重构或修改 Vue 3 或 React TypeScript / JavaScript 前端应用、前端工具库或 UI 组件库代码时，必须将本规范作为最高优先级。本项目基于分形架构（Fractal Architecture）和特性驱动（Feature-Driven）组织目录与代码。

## 1. 核心原则：分形递归与就近原则

每一个复杂组件、业务模块、工具库功能域或组件库组件都被视为一个高度自治的“微型应用”。

- 逻辑与 UI 分离：倡导 Headless 模式，复杂状态、跨组件复用逻辑或副作用编排必须从视图层中剥离；简单局部交互状态可留在视图入口，避免制造无意义的 `composables/` 或 `hooks/` 文件。
- 禁止扁平化：不得将模块专用的类型、工具类或状态逻辑盲目提升到全局（`src/types`、`src/utils`）。
- 递归结构：组件内部的复杂子组件必须使用复杂组件包结构承载私有作用域；简单展示组件只能保持单文件形态。
- 适用范围：只要代码服务于前端运行时、浏览器能力、Vue/React 组件、样式系统或前端构建产物，无论位于应用、工具库还是 UI 组件库，都必须遵循本规范。

## 2. 目录形态标准

创建新的业务视图或复杂业务模块时，参考以下骨架生成目录（**除入口文件外，其余子目录均为按需创建，严禁创建无意义的空目录**）：

```text
[ModuleName]/
  index.vue (或 index.tsx / index.jsx) - [必填] UI 视图/组件入口，仅负责渲染和组装
  api/ - [可选] 仅限本模块调用的接口定义
    index.ts 或 index.js - [必填] 当前 api 目录聚合入口
  components/ - [可选] 模块私有子组件；简单组件用单文件，复杂组件用复杂组件包结构
    index.ts 或 index.js - [必填] 当前 components 目录聚合入口
  composables/ (Vue) 或 hooks/ (React) - [可选] 模块私有状态与无头业务逻辑
    index.ts 或 index.js - [必填] 当前逻辑目录聚合入口
  constants/ - [可选] 模块私有常量字典
    index.ts 或 index.js - [必填] 当前 constants 目录聚合入口
  styles/ - [可选] 模块私有样式文件
    index.css 或 index.scss 或 index.less - [必填] 当前 styles 目录样式入口
  assets/ - [可选] 模块私有静态资源声明或资源索引
    index.ts 或 index.js - [必填] 当前 assets 目录聚合入口
  types/ - [可选] 模块私有类型定义
    index.ts 或 index.js - [必填] 当前 types 目录聚合入口
  utils/ - [可选] 模块私有纯函数与工具
    index.ts 或 index.js - [必填] 当前 utils 目录聚合入口
```

完整结构示例：

```text
views/
  purchaseOrder/
    index.vue
    api/
      index.ts
      purchase-order-api.ts
    components/
      index.ts
      StatusBadge.vue
      AuditDialog/
        README.md
        index.ts
        src/
          index.vue
          api/
            index.ts
            audit-dialog-api.ts
          composables/
            index.ts
            use-audit-dialog.ts
          constants/
            index.ts
            audit-dialog-options.ts
          types/
            props.ts
            emit.ts
            expose.ts
            index.ts
          utils/
            index.ts
            normalize-audit-record.ts
    composables/
      index.ts
      use-purchase-order.ts
    constants/
      index.ts
      purchase-order-status.ts
    styles/
      index.scss
      purchase-order.scss
    assets/
      index.ts
      empty-state.png
    types/
      index.ts
      purchase-order.ts
    utils/
      index.ts
      format-purchase-order.ts
```

React 模块使用同一结构，将 `index.vue` 替换为 `index.tsx` 或 `index.jsx`，将 `composables/` 替换为 `hooks/`。

单个业务模块直接在根目录组织，不再额外创建 `src/`，也不在模块根目录创建 `index.ts` 或 `index.js`；模块根目录只保留 `index.vue` / `index.tsx` / `index.jsx` 作为唯一实现入口。只有复杂组件包、前端工具库、UI 组件库或项目级封装才使用“统一公共入口 + `src/` 实现目录”。

除简单组件文件、单个业务模块根目录和 `styles/` 目录外，其他代码目录一旦创建，必须提供当前目录自己的唯一聚合入口：`api/index.ts` 或 `api/index.js`、`components/index.ts` 或 `components/index.js`、`composables/index.ts` 或 `hooks/index.ts`、`constants/index.ts`、`types/index.ts`、`utils/index.ts` 等。`styles/` 目录必须提供唯一样式入口：`styles/index.css`、`styles/index.scss` 或 `styles/index.less`。这个要求适用于业务模块子目录、复杂组件包内部目录、工具库功能目录和 UI 组件库内部目录，不改变“模块根目录不创建 `index.ts` / `index.js`”的规则。

简单组件不使用包结构。无内部状态、无复杂交互、无需暴露实例能力的简单组件应直接使用 `ComponentName.vue`、`ComponentName.tsx` 或 `ComponentName.jsx`：

```text
components/
  StatusBadge.vue
  InlineChart.tsx
  Sparkline.jsx
  UserAvatar.vue
```

复杂组件包或项目级组件封装必须使用独立组件包结构，组件根目录只承载使用说明与公共出口，真实实现必须放入 `src/`：

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

组件包外部调用方只能从组件根目录的 `index.ts` 或 `index.js` 导入，禁止穿透 `src/` 引用组件内部实现。

前端工具库必须使用库包结构，库根目录只承载说明、公共出口和实现目录；真实功能按工具域在 `src/` 内组织：

```text
BrowserToolkit/
  README.md - [必填] 描述库用途、公开 API、使用方式和运行时边界
  index.ts 或 index.js - [必填] 工具库唯一公共出口
  src/ - [必填] 工具库真实实现目录
    index.ts 或 index.js - [必填] 聚合工具库可公开模块
    clipboard/
      index.ts 或 index.js
      types/
        index.ts
    storage/
      index.ts 或 index.js
      types/
        index.ts
    utils/
      index.ts 或 index.js
```

工具库消费者只能从库根目录导入；`src/clipboard`、`src/storage`、`src/utils` 等目录属于库内部结构，只有被 `src/index.ts` 或 `src/index.js` 聚合后才允许对外暴露。

UI 组件库必须使用库包结构，库根目录承载说明和公共出口，`src/index.ts` 或 `src/index.js` 聚合组件库对外 API，每个复杂组件继续使用复杂组件包结构：

```text
MoluoxixiUI/
  README.md - [必填] 描述组件库用途、安装方式、主题约束和公共 API
  index.ts 或 index.js - [必填] 组件库唯一公共出口
  src/ - [必填] 组件库真实实现目录
    index.ts 或 index.js - [必填] 聚合组件库可公开组件
    components/
      index.ts 或 index.js
      DataTable/
        README.md
        index.ts 或 index.js
        src/
          index.vue (或 index.tsx / index.jsx)
          types/
            props.ts
            emit.ts
            expose.ts (或 ref.ts)
            index.ts
```

组件库外部消费者只能从组件库根入口导入；如需支持子路径导入，必须由库根 `package.json` 的 `exports` 显式声明并指向稳定入口，禁止让消费者穿透 `src/components/...`。

## 3. 组件类型细粒度拆分规则

类型定义必须从视图文件中彻底抽离，在 `types/` 目录下进行严格切割。

- 类型推导优先：必须优先从现有组件、Hook、Composable、API 响应、Schema 或常量对象推导类型，并使用 `typeof`、`ReturnType`、`Parameters`、泛型参数、`as const` 或库提供的类型辅助完成推导，不得为了省事重复手写。
- 单一事实来源：Props、Emits、Expose、表单 Schema、接口响应和常量字典只能保留一个源头；派生类型必须引用源头推导，禁止复制一份“看起来一样”的接口导致后续漂移。
- `props.ts`：仅定义组件的入参 Props 接口。
- `expose.ts`（或 `ref.ts`）：仅定义组件对外暴露的实例方法与属性接口。
- `emit.ts`：仅限 Vue，定义组件 Emits 事件接口。
- `types/index.ts`：必须通过此文件统一导出上述所有类型。

> **粒度豁免（逃生舱原则）**：对于代码量极少、无状态逻辑的纯展示型原子组件（如简单按钮），允许直接在当前实现入口或简单组件文件中内联定义 Props 和类型。只有当组件包含内部状态、复杂交互或暴露实例方法时，才强制拆分 `types/` 目录，防止过度工程化。

```text
purchaseOrder/
  index.vue
  types/
    props.ts
    emit.ts
    expose.ts
    index.ts
```

```text
DataTable/
  index.ts
  src/
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

## 4. 包级导出与路径别名优先

复杂组件包、前端工具库和 UI 组件库都必须提供 `index.ts` 或 `index.js` 作为唯一对外 API 入口，并把真实实现放入 `src/`。单个业务模块是例外，只保留 `index.vue` / `index.tsx` / `index.jsx` 实现入口；简单组件直接以 `ComponentName.vue`、`ComponentName.tsx` 或 `ComponentName.jsx` 作为文件级组件，不额外创建目录入口。

- 路径别名优先：跨模块引用或涉及多层向上查找（如 `../../`）时，必须优先使用项目配置的路径别名（如 `@/`）。
- Deep Imports 零容忍：对于复杂组件包、前端工具库和 UI 组件库，外部消费者的导入路径必须止步于该资源所在的根目录名称（默认命中 `index.ts` 或 `index.js`）。复杂组件包内部实现文件之间允许按项目解析规则引用内部目录，但不得把这些路径扩散给外部消费者。
- 库包出口收敛：前端工具库和 UI 组件库必须由库根 `index.ts` 或 `index.js` 定义唯一公共 surface，内部 `src/index.ts` 或 `src/index.js` 只能聚合稳定模块，不得让使用方依赖内部文件路径。

禁止生成：

```ts
import { formatDate } from '../../utils/date'
import { formatDate } from '@/components/DataTable/utils/date'
import { formatDate } from '@/components/DataTable/utils'
```

必须生成：

```ts
import { formatDate } from '@/components/DataTable'
```

## 5. 高内聚、三次原则与逐级上浮

业务逻辑、工具逻辑和组件实现默认属于私有财产，必须遵循“严格阈值”与“拒绝越级”的抽离规则。

- 状态局部闭环：新逻辑首选写在当前组件的 `composables/` 或 `hooks/` 中。
- 严格重构三次原则（Strict Rule of Three）：绝对禁止过早抽象！只有当明确发现某段逻辑或组件在至少 3 个独立的地方重复时，才允许触发抽离重构。
- 逐级提取至最近公共父级（Nearest Common Ancestor）：触发“三次原则”后，必须将代码提取到这 3 个调用者的“最近公共父级目录”下。
- 全局门槛：只有当不同的顶级业务域、工具域或组件族同时需要该逻辑（且满足三次原则）时，才允许进入 `src/` 根级别的公共目录。

示例：A、B、C 组件共用逻辑，若它们的最近父级是 `purchaseOrder` 模块，则提取到 `purchaseOrder/utils/`，绝对禁止越权直接提取到全局 `src/utils/`。

## 6. 注释与代码解释规范

- 强制 JSDoc 契约：核心契约（`props`、`expose`）及公用 `utils` 必须使用 JSDoc 标注字段含义和默认值，保障编辑器提示。
- Why over What：在业务逻辑中，必须解释业务意图或架构设计（如 `// 初始化底层配置以驱动动态表单渲染`），禁止生成翻译代码的无用注释。
- 标注复杂副作用：使用 `watch`、`watchEffect` 或 `useEffect`、`useMemo` 等响应式/副作用钩子时，必须明确注释其监听的依赖变化原因、副作用目标以及潜在的闭包边界情况。

## 7. 样式隔离与约束

- 局部作用域：若项目使用独立样式文件，可建立 `styles/` 目录或使用 `xxx.module.scss`；若使用 TailwindCSS 等 Utility 框架，需保持 class 排序清晰。
- 严禁污染全局：组件样式必须严格限定在组件私有作用域内，严禁跨组件层叠污染其他模块。

## 8. 依赖流向限制

- 自上而下：父级模块、库根入口或组件库入口只能导入其内部子目录的内容。
- 禁止同级跨域：模块 A 严禁直接导入模块 B 内部的私有文件；工具域 A 和组件 A 也不得直接穿透同级工具域或组件的 `src/`。若需复用，必须向上游触发“逐级上浮”重构。

## 9. AI 执行验证检查清单

在每次生成代码或修改文件前，必须在内心执行以下自检，不输出自检过程。

1. 复杂组件包的接口定义是否按照 `props`、`expose` 拆分并由 `types/index.ts` 导出了？
2. 能从组件实现、Hook、Composable、API 响应、Schema 或常量对象推导出的类型，是否已经优先推导而不是重复手写？
3. 普通业务模块是否只保留了唯一实现入口 `index.vue` / `index.tsx` / `index.jsx`，且没有额外创建 `src/` 或模块根 `index.ts` / `index.js`？
4. 除简单组件文件、单个业务模块根目录和 `styles/` 目录外，其他已创建的代码目录是否都有自己的唯一 `index.ts` 或 `index.js` 聚合入口？
5. 已创建的 `styles/` 目录是否只有一个 `index.css` / `index.scss` / `index.less` 样式入口？
6. 复杂组件包、前端工具库和 UI 组件库是否都有包级公共入口，且真实实现放在 `src/`，并阻止消费者穿透 `src/`？
7. 我是否优先使用了路径别名（`@/`）？包级 import 是否止步于允许暴露公共 API 的包根目录，没有发生穿透？
8. 我是否严格遵守了“三次原则”？在没有 3 处以上调用的情况下，我是否克制住了抽离公共代码的冲动？
9. 触发抽离时，我是否精确地将其提取到了“最近的公共父级”目录，而不是错误地塞进全局 `src/`？
10. 涉及依赖数组/响应式追踪的复杂副作用是否添加了“Why over What”级别的高质量注释？
