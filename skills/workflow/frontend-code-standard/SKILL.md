---
name: frontend-code-standard
description: 用于 Vue 3 / React TypeScript/JavaScript 前端应用、组件、业务模块、工具库和 UI 组件库的统一实现标准，覆盖实现质量、目录边界、公共导出、import 路径、类型契约、评审输出和交付检查。
---

# 前端编码规范

## 用途

本 Skill 是前端实现与评审的统一规则源，覆盖组件、业务模块、前端工具包和 UI 组件库。

它不是只管目录拆分的窄规则，重点是实现质量、目录边界、公共导出、import 路径、类型契约和交付检查。

当任务是评审、检查或判断是否符合标准时，先给出目标分类和检查范围，再输出问题点与改动建议，不得只复述规则。

## 工作顺序

1. 先确认目标职责、调用方契约、真实交互路径和项目已有前端栈。
2. 判断目标属于 `simple-component`、`component-package`、`business-module`、`ordinary-module`、`utility-library` 或 `ui-library`。
3. 先复用项目已有 UI 基础设施、hooks、composables、样式体系、校验库和测试工具。
4. 直接按目标职责重建结构、公共 API、状态边界和类型出口，不保留无价值兼容层。
5. 完成后按风险执行项目已有 lint、typecheck、test、build 或浏览器验证；缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

## 分类标准

### simple-component

- 直接使用 `ComponentName.vue`、`ComponentName.tsx` 或 `ComponentName.jsx`。
- 适用于职责单一、无独立包级 API 的组件。
- **物理边界约束**：简单组件必须严格保持单文件（或仅伴随一个同名样式文件）。
- **升级阈值**：一旦该组件内部逻辑膨胀，需要剥离出私有子组件（如 `SubComponent.vue`）、私有工具函数、私有常量或独立的类型声明文件时，必须立即向上重构为 `component-package` 结构，绝对禁止在简单组件同级平铺散落这些专属附属文件。

### component-package

- 使用根 `README.md`、`index.ts` / `index.js` 和 `src/`。
- **适用场景**：作为提供复杂能力的独立包，或当简单组件突破单文件阈值（需要私有附属文件）时，必须采用此结构。
- 根入口只暴露稳定公共 API；内部实现（包括上述私有附属文件）必须全部收敛在 `src/` 内部。
- `src/` 下只能保留一个核心实现入口：`index.vue`、`index.tsx` 或 `index.jsx`。
- README 必须说明使用方式、公开契约（props、emits、slots、ref、expose）、主要状态和限制条件。

### business-module

- 根入口使用 `index.vue`、`index.tsx` 或 `index.jsx`。
- 围绕一个页面、流程或领域能力组织，而不是围绕技术名词先建目录。
- 模块私有 API、常量、类型、组件和工具默认留在模块内。

### ordinary-module

- 单个模块以实现入口为中心组织，不创建包级公共出口。
- 普通模块根目录不得额外创建 `index.ts` / `index.js` 作为包级公共 API。
- 普通实现目录可用 `index.ts` / `index.js` 做本地聚合，但不得伪装成包级 API。

### utility-library

- 使用根 `README.md`、`index.ts` / `index.js` 和 `src/`。
- `src/` 下使用 `index.ts` / `index.js` 作为聚合入口。
- 工具函数保持纯净、可组合、可测试；涉及副作用时显式表达依赖。

### ui-library

- 使用根 `README.md`、`index.ts` / `index.js` 和 `src/`。
- `src/components/` 下至少包含一个复杂组件包。
- UI 组件库组件之间通过公共入口协作，不互相穿透内部 `src/`。

## 通用实现原则

- 契约优先：props、emits、slots、ref、callback 和 children 必须表达真实调用契约。
- 文件与目录命名约束：UI 组件文件及其专属目录必须使用 `PascalCase`（如 `DataTable.vue`、`AuditDialog/`）；纯逻辑文件、工具函数、Hooks 以及非组件的业务模块目录必须使用 `kebab-case`（如 `use-table-sort.ts`、`purchase-order/`）。严禁同级混用命名风格，以彻底杜绝跨操作系统（macOS/Windows vs Linux）大小写不敏感导致的 CI/CD 构建失败。
- UI 与逻辑解耦：在复杂组件或底层库中，优先采用 Headless 架构，将核心状态、校验和业务逻辑独立，UI 渲染层仅负责消费状态和触发事件。
- 配置与元数据隔离：在配置驱动或复杂递归场景中，Schema（如 Zod、JSON Schema）或元数据（Meta）既是运行时的校验逻辑，又是类型推导的单一事实来源。它们必须作为核心契约，独立存放在专属文件或目录（如 `src/schemas/`）中，确保 UI 渲染层只消费契约而不负责定义。
- 就近内聚 (Co-location) 与演练场隔离：组件、模块或工具包私有的常量 (`constants`)、类型 (`types`)、工具函数 (`utils`) 和 hooks 必须收敛在自身的内部目录中。单元测试文件（`.test.ts` / `.spec.ts`）必须放在同级 `__tests__/` 目录中；交互示例或 Storybook 文件必须放在同级 `__demos__/` 或 `__stories__/` 目录中。这些辅助工程文件必须与生产代码物理隔离，严禁直接混入 `src/` 核心图谱，严禁在根目录建立大而全的镜像测试目录。
- 状态就近：组件或模块私有状态留在就近边界内；只有跨组件共享、跨页面保留或流程边界明确时才上浮到 store 或 Context。
- 逻辑贴近使用点：私有逻辑默认留在组件或模块内部；只有复用、测试或复杂度收益明确时才抽到 hook、composable 或普通函数。
- 聚合导出 (Barrel Export) 与防循环依赖：在公共层级（如 `src/components`、`src/utils`、`src/constants`）必须维护顶层的 `index.ts` 作为统一聚合入口。外部调用方强制按层级干净导入（如 `import { Button } from '@/components'`），严禁绕过顶层入口直接导入下级包。
- 内部引用隔离：同级目录下的内部实现文件之间，严禁通过自身的公共 `index.ts` 互相导入，必须使用直接相对路径引用，以彻底杜绝循环依赖。
- 失败显性与异常语义化：输入、依赖或运行状态不满足契约时暴露失败，不写静默兜底或伪成功。在复杂模块或底层库抛出异常时，**严禁直接 `throw new Error('纯文本')`**，必须抛出包含特定错误码和上下文参数的自定义领域错误类（如 `FormValidationError`、`ModuleLoadError`），以便调用方精准捕获与降级。
- 类型扩展性与显式返回：对外暴露的公共对象契约（如组件 Props、配置项）强制使用 `interface` 定义，保留 TypeScript 的声明合并（Declaration Merging）能力；仅在需要联合/交叉类型时使用 `type`。所有包级或模块级公共出口的函数、Hooks 和类，**强制显式声明返回类型**，严禁依赖自动推导，以防止私有类型意外泄漏并极大提升宿主应用的 TS 编译性能。
- 抽象要付账：新目录、新 hook、新 composable、新 wrapper 必须减少至少两个调用方的重复代码或消除一个具体错误类别。
- 注释解释意图：注释只说明契约、边界、业务例外和非显然取舍，不复述实现步骤。

## Vue 3 标准

- 默认使用 Composition API 和 `<script setup>`。
- `defineProps`、`defineEmits`、`defineSlots`、`defineExpose` 的类型与运行时行为必须一致。
- props 默认值优先使用 Vue 3.5+ 的响应式解构；维护旧版本时使用 `withDefaults(defineProps(...), ...)`。绝对不要在业务逻辑里用二次合并或 `??` / `||` 伪造默认契约。
- 组件需要标准 `v-model` 契约时优先使用 `defineModel`（Vue 3.4+）。
- 只有多路 model、第三方契约或现有项目约定明确要求时，才回到手写 `modelValue` / `update:modelValue`。
- 多个 v-model 时使用具名 model：`defineModel<string>('title')`、`defineModel<boolean>('visible')`。
- 优先使用 `useTemplateRef`（Vue 3.5+）；只有版本或工具链不支持时才回退到 `ref()` + 模板 `ref="xxx"`。
- `computed` 用于派生状态，`watch` 用于同步外部副作用，不用 `watch` 复制可计算状态。
- `watchEffect` 用于自动追踪依赖的副作用；明确依赖时优先 `watch`。
- `provide/inject` 只用于跨层级组件通信，不用于替代 props 传递。
- 必须提供 InjectionKey 类型和默认值或显式错误。
- 避免在 `setup` 顶层执行副作用；副作用放入生命周期钩子或 `watchEffect`。

## React 标准

- 默认使用 function component 和 hooks。
- 不使用 class component，除非维护遗留代码或需要 Error Boundary（React 19 前）。
- 组件函数命名使用 PascalCase，hooks 使用 `use` 前缀。
- props 使用 TypeScript interface 或 type 声明，命名为 `ComponentNameProps`。
- `useEffect` 只用于同步外部系统（DOM、订阅、网络）；派生状态用计算或 `useMemo`。
- `useMemo`、`useCallback`、`memo` 只用于真实稳定性或性能边界，不为“看起来优化”滥用。
- React 19+ 时，ref 可直接作为 prop 接收；React 18 时需要暴露 DOM 或方法时使用 `forwardRef` + `useImperativeHandle`。
- `useImperativeHandle` 只暴露调用方真正需要的方法，不泄露内部实现。
- Context 只用于跨层级共享不频繁变化的数据（主题、locale、auth）。
- 频繁变化的状态不放 Context，避免不必要的子树重渲染。
- 提供 custom hook 封装 Context 消费，内含空值检查和错误提示。

## 组件标准

- 组件只对外暴露必要能力；不要把内部实现、临时状态或工具函数泄露成公共 API。
- 复杂表单、嵌套组件优先采用原子化设计与递归组合（通过 slots 组装层级），而非庞大的臃肿容器组件。
- 交互组件必须覆盖当前职责下真实存在的 loading、disabled、empty、error、readonly、focused 等状态。
- 表单组件必须明确受控/非受控模型、校验触发时机和错误展示来源。
- 可访问性交互必须包含语义元素、键盘路径、焦点管理和必要 ARIA。
- 样式优先使用项目已有样式体系（Scoped CSS、CSS Modules、UnoCSS/Tailwind、styled-components）；同一项目不混用多种样式方案。
- 简单组件的类型优先贴近使用点，写在同一文件内。
- 复杂组件可按职责拆分 `types/props.ts`、`types/emit.ts`、`types/ref.ts`、`types/expose.ts`、`types/context.ts` 和 `types/index.ts`。
- 类型出口必须严格分离，**强制使用 `export type` 或 `export type *`**（例如 `export type * from './props'`）。严禁使用 `export *` 混合导出类型和值，以确保 Vite/ESBuild（`isolatedModules`）环境下的编译安全和最佳的 Tree-shaking 效果。
- 路径别名优先；外部调用方强制只通过层级的顶层聚合入口（如 `@/components`）导入。
- 禁止 deep import，不得穿透到组件内部 `src/`、私有目录或绕过顶层 API 去导入具体包文件。

## 业务模块标准

- 模块页面和组件默认使用 `<script setup>` 或 function component。
- `defineProps`、`defineEmits`、`defineSlots`、`defineExpose` 的类型与运行时行为必须一致。
- 模块状态默认留在当前页面组件内（随组件卸载自动清理）；只有跨模块共享、跨页面保留或业务流程要求时才上浮到 store 或外部状态。**一旦状态上浮，必须同时提供并在对应生命周期（如 `onUnmounted`）主动调用状态清理契约**，严防 SPA 路由切换导致的状态残留或内存泄漏。
- 模块私有常量、类型、组件和工具默认留在模块内（就近内聚原则）。
- **务实的复用与拆分时机**：摒弃死板的“三次法则”。当逻辑满足以下任一条件时即应拆分提取：
  1. 出现 **2 个**明确的独立使用点（贯彻 DRY 原则）。
  2. 逻辑过于复杂（如核心正则验证、复杂数据推导），需要建立独立的单元测试边界。
- 不要因为文件变长就机械拆分；拆分必须对应可命名的职责、复用点或测试边界。
- **按领域边界而非物理交集提升**：公共代码的提取存放层级，必须由其**领域通用性**决定，而不是单纯计算调用者的**物理“最近公共父级（LCA）”**：
  - **全局基建**（如日期处理、请求封装）：即使目前只有一个模块使用，只要其本质与具体业务解耦，应直接提升至全局 `@/utils` 或 `@/composables`。
  - **跨域业务资产**（如订单状态字典）：一旦发生或预期发生跨业务域的复用，应提取至共享领域目录（如 `src/domain/shared/`）。
  - **局部业务逻辑**：仅在当前模块内多处复用的辅助逻辑，才就近提升到该模块的 `src/utils/` 中。
- 单个模块不得再嵌套深层 `src/` 目录。
- 前端目录遵循单一入口、按需拆分。
- 路径别名优先：跨模块引用或多层级向上查找时，严格统一使用层级聚合入口导出。
- 禁止 deep import；外部不得穿透到具体实现文件、私有目录或伪共享层。

## 工具包与 UI 组件库标准

- 工具包、UI 组件库和独立组件包都必须把公共 API 和内部实现分层。
- 只有 `component-package`、`utility-library` 和 `ui-library` 允许通过根 `index.ts` / `index.js` 暴露包级公共 API。
- 根入口只暴露稳定公共 API；内部实现留在 `src/`。
- `styles/` 只使用一个 `index.css`、`index.scss` 或 `index.less` 作为样式入口。
- README 必须说明使用方式、公共 API、主要约束和典型示例。
- **Tree-shaking 契约**：所有提供聚合导出（`index.ts`）的包，必须在其 `package.json` 中显式声明 `"sideEffects"` 字段。除样式文件外，纯逻辑代码必须声明为 `sideEffects: false`，确保构建工具能够安全清除死代码。
- **依赖声明隔离**：严格管理 `package.json`。宿主环境依赖（如 `vue`, `react`, `zod` 等）必须声明为 `peerDependencies`，绝对禁止放入 `dependencies` 中，以防在宿主应用打包出多个实例导致响应式死锁或上下文断裂。
- 禁止为了兼容旧导出路径保留双 barrel、镜像目录或重复实现。
- UI 组件库组件之间通过公共入口协作，不互相穿透内部 `src/`。
- 涉及浏览器、时间、随机数、网络和存储时显式表达依赖和失败语义。

## 评审输出

当任务是评审、检查或判断是否符合标准时，先给出目标分类和检查范围，再输出问题点与改动建议，不得只复述规则。

### 必须包含

1. 目标分类
2. 检查范围
3. 总结论
4. 问题列表
5. 改动建议汇总

### 总结论

- 只能使用 `PASS`、`FAIL`、`MISSING` 或 `NOT RUN`

### 每个问题都必须包含

- 编号
- 严重级别：`critical`、`major` 或 `minor`
- 对应规则点
- 证据：文件路径和位置
- 问题说明：说明为什么不符合当前目标，而不是只复述规则
- 改动建议：给出可直接执行的修改方向、目标文件和建议落点

### 禁止

- 只复述规则，不指出当前代码哪里不符合。
- 只写“建议优化”“建议调整”“建议规范化”这类空泛建议。
- 没有证据就下结论。
- 把未检查项、缺少脚本或未验证内容写成 `PASS`。
- 把结构校验脚本的 `PASS` 当成实现整体 `PASS`。

## 示例

### 简单组件（simple-component）

```text
components/
├── StatusBadge.vue
├── UserAvatar.vue
├── InlineChart.vue
├── __tests__/
│   └── StatusBadge.spec.ts
└── __demos__/
    └── StatusBadge.story.vue
````

符合物理边界约束，严禁在此同级散落如 `format-avatar.ts` 等专属逻辑文件。若需附属文件，必须触发阈值升级为复杂组件包。测试和演练场遵循就近隔离原则。

### 复杂组件包（component-package）

```text
DataTable/
├── README.md
├── index.ts
└── src/
    ├── index.vue
    ├── schemas/
    │   └── column-schema.ts
    ├── composables/
    │   ├── index.ts
    │   └── use-table-sort.ts
    ├── components/
    │   ├── index.ts
    │   ├── BodyRow.vue                  <-- 简单的私有子组件（单文件）
    │   └── AdvancedFilter/              <-- 复杂的私有子组件（触发阈值，递归套用包结构）
    │       ├── index.ts
    │       └── src/
    │           ├── index.vue
    │           └── utils/
    │               └── filter-parser.ts
    ├── types/
    │   ├── index.ts
    │   ├── props.ts
    │   └── emit.ts
    ├── utils/
    │   ├── index.ts
    │   └── normalize-column.ts
    └── styles/
        └── index.scss
````

**内部依赖与公共依赖边界：**
- **私有内聚**：像 `BodyRow` 或 `AdvancedFilter` 这种**仅服务于** `DataTable` 的私有组件，必须收敛在自身 `src/components/` 内。如果私有子组件自身也突破了单文件阈值（复杂度过高），允许且应当在内部递归套用 `component-package` 结构（如上方的 `AdvancedFilter`）。
- **公共上浮**：如果是 `Checkbox` 或 `Pagination` 等具备全局通用性的组件，**绝对禁止**强行内聚或圈养在 `DataTable` 内部。必须提取到全局公共组件库（`@/components/Pagination`），`DataTable` 仅通过顶层公共契约（`@/components`）进行外部导入。

### 工具包（utility-library）

```text
clipboard-toolkit/
├── README.md
├── package.json        <-- 声明 peerDependencies 与 sideEffects
├── index.ts
└── src/
    ├── index.ts
    ├── clipboard/
    │   ├── index.ts
    │   ├── api/
    │   │   ├── index.ts
    │   │   └── clipboard-api.ts
    │   └── constants/
    │       ├── index.ts
    │       └── clipboard-options.ts
    ├── utils/
    │   ├── index.ts
    │   └── normalize-text.ts
    └── types/
        └── index.ts
````

**层级聚合导出示例：**

```ts
// 1. clipboard-toolkit/src/clipboard/index.ts
export * from './api'
export * from './constants'

// 2. clipboard-toolkit/src/index.ts (内部核心聚合层)
export * from './clipboard'
export * from './utils'
export * from './types'

// 3. clipboard-toolkit/index.ts (对外最终 API 门面)
export { copyText, readText } from './src'
// 使用 interface 保证公共契约的 Declaration Merging 扩展能力
export type { CopyTextOptions, ReadTextOptions } from './src'
````

```md
# ClipboardToolkit

剪贴板操作工具包。

## 使用

```ts
import { copyText } from '@example/clipboard-toolkit'

await copyText({ text: 'Hello', navigator: window.navigator })
```

## 约束

- 必须显式传入 navigator，不依赖全局对象。
````

### UI 组件库（ui-library）

```text
MoluoxixiUI/
├── README.md
├── package.json
├── index.ts
└── src/
    ├── index.ts
    ├── components/
    │   ├── index.ts    <-- 组件层聚合入口
    │   ├── Button/
    │   │   ├── README.md
    │   │   ├── index.ts
    │   │   └── src/
    │   │       ├── index.vue
    │   │       └── types/
    │   │           ├── index.ts
    │   │           └── props.ts
    │   └── DataTable/
    │       ├── README.md
    │       ├── index.ts
    │       └── src/...
    ├── composables/
    │   ├── index.ts    <-- 逻辑层聚合入口
    │   └── use-theme.ts
    └── styles/
        └── index.scss
````

**层级聚合导出示例：**

```ts
// 1. MoluoxixiUI/src/components/index.ts
export { Button } from './Button'
export { DataTable } from './DataTable'
export type { ButtonProps } from './Button'
export type { DataTableProps, DataTableColumn } from './DataTable'

// 2. MoluoxixiUI/src/composables/index.ts
export { useTheme } from './use-theme'

// 3. MoluoxixiUI/src/index.ts (内部主聚合出口)
export * from './components'
export * from './composables'

// 4. MoluoxixiUI/index.ts (对外最终 API 门面)
export * from './src'
````

### 页面模块

```text
views/
└── purchase-order/
    ├── index.vue
    ├── api/
    │   ├── index.ts
    │   └── purchase-order-api.ts
    ├── components/
    │   ├── index.ts
    │   ├── StatusBadge.vue
    │   └── AuditDialog/
    │       ├── README.md
    │       ├── index.ts
    │       └── src/
    │           └── index.vue
    ├── styles/
    │   ├── index.scss
    │   └── purchase-order.scss
    └── types/
        ├── index.ts
        └── purchase-order.ts
````

公共代码上浮到最近公共祖先，同时遵从领域通用性质判断是否继续上浮至全局。

### 类型组织与导入隔离

```ts
// types/index.ts
export type * from './props'
export type * from './ref'
export type * from './emit'
export type * from './expose'
````

```ts
// ✅ 正确：外部调用方严格统一只通过所在层的顶级聚合 API 入口（Barrel）干净导入
import { DataTable } from '@/components'
import type { DataTableColumn } from '@/components'
import { copyText } from '@/utils'

// ❌ 错误：触发禁止 deep import 规则（即使是包级别入口，若存在层级统一出口也不得绕过）
// import { DataTable } from '@/components/DataTable'
// import { copyText } from '@/utils/clipboard-toolkit'

// ❌ 错误：触发禁止 deep import 规则（绕过所有聚合层直达实现文件）
// import { useTableSort } from '@/components/DataTable/src/composables/use-table-sort'

// ❌ 错误：同级内部文件之间触发循环依赖风险
// 在 DataTable 组件内部文件引用自身的 utils 时：
// import { normalizeColumn } from '@/components/DataTable' // 禁止！通过出口入口倒流
// import { normalizeColumn } from '../utils/normalize-column' // 必须！使用物理相对路径
````

## 自校验脚本与检查策略

根目录提供的 `scripts/verify-rules.mjs` 应作为 CI/CD 和 Git Hooks 的前置卡口，包含以下 4 个核心检查器实现：

1. **物理结构与阈值检查器 (FS Structural Checker)**
   - `simple-component`：扫描同级目录，发现除样式和 `__tests__` / `__demos__` 外的 `.ts`/`.vue` 专属文件即抛出阈值超载错误，强制升级。
   - 复杂包 (`component-package` 等)：强制校验是否包含 `index.ts` 出口与包含唯一业务入口的 `src/` 结构。
2. **命名规范扫描器 (Naming Convention Scanner)**
   - 拦截系统差异：UI 文件及包含 UI 的目录硬性匹配 `PascalCase`；纯逻辑代码及业务模块硬性匹配 `kebab-case`。
3. **导入路径 AST 分析器 (Import Path Analyzer)**
   - 拦截 Deep Import：解析 AST，发现 import 路径绕过了层级聚合出口（如存在 `@/components/index.ts` 时使用 `@/components/DataTable/xxx`）即报错。
   - 拦截循环依赖：检查同级目录下的模块是否通过外层的 `index.ts` 聚合出口相互导入。
4. **领域与层级提升异常扫描器 (Hoist Anomaly Scanner)**
   - **注意**：脚本无法真正理解“业务语义”。此校验器仅计算多个消费者的物理最近公共祖先 (LCA)。
   - **执行逻辑**：如果脚本发现某段代码被放置在全局（如 `src/utils/`），但其所有调用方全部分布在同一个极深的单业务域内（如全部在 `src/views/purchase-order/` 下），脚本将抛出 `[HOIST_WARNING]` 警告。
   - **人工介入**：触发警告后，强制要求人工 Code Review 核实：该代码究竟是“真全局通用基建”（允许通过），还是“不慎泄漏到全局的专属业务逻辑”（必须降级内聚）。

**常用命令：**
- `node scripts/verify-rules.mjs simple-component --root src/components/StatusBadge.vue`
- `node scripts/verify-rules.mjs component --root src/components/DataTable`
- `node scripts/verify-rules.mjs module --root src/views/purchase-order`
- `node scripts/verify-rules.mjs utility --root packages/browser-toolkit`
- `node scripts/verify-rules.mjs ui-library --root packages/MoluoxixiUI`
- `node scripts/verify-rules.mjs hoist --target src/views/order-shared/utils --uses src/views/purchase-order/index.vue src/views/sales-order/index.vue src/views/refund-order/index.vue`

## 检查清单

1. 是否先写了目标分类？
2. 是否明确写出本次实际检查范围？未检查部分是否标记 `NOT RUN`？
3. 总结论是否只使用 `PASS`、`FAIL`、`MISSING` 或 `NOT RUN`？
4. 每个问题是否都包含规则点、证据、问题说明和可执行改动建议？
5. 改动建议是否具体到文件和建议落点，而不是空泛措辞？
6. 是否把结构校验脚本的 `PASS` 错写成实现整体 `PASS`？
7. 是否存在没有证据就下结论的断言？
8. 是否运行了与风险匹配的现有 lint、typecheck、test、build 或浏览器验证？
9. 是否把简单组件、复杂组件、普通模块、业务模块、工具包和 UI 组件库分开判断？
10. 是否检查了简单组件的**物理边界阈值**（无散落文件）？是否验证了就近内聚原则与同级目录无**循环依赖**引用？
11. 是否检查了**文件命名约束**（组件 PascalCase，逻辑/模块 kebab-case）和**状态清理契约**（SPA 路由切换防残留）？
12. 库开发项目是否正确配置了 `sideEffects` Tree-shaking 契约与 `peerDependencies` 环境隔离？公开契约是否采用了可扩展的 `interface` 以及显式声明的返回类型？
13. 公共代码是否按照**领域边界**正确提升，而不是单纯受困于机械的物理最近公共父级？是否保证了层级隔离和统一顶层导入要求？

### 评审输出示例

```md
## 评审输出

### 目标分类
component-package

### 检查范围
已检查 src/components/DataTable/index.ts、src/components/DataTable/src/types/props.ts、src/views/purchase-order/index.vue

### 总结论
FAIL

### 问题列表
1. [major] 规则点：层级导入契约禁止绕过顶层 API
   证据：src/views/purchase-order/index.vue:12
   问题说明：调用方绕过了 @/components 顶层聚合出口，穿透到了具体的 DataTable/src/... 路径，破坏了外部调用的无感重构体验。
   改动建议：将对应工具方法提升并统一从 @/components/index.ts 导出，调用方修改为 import { useTableSort } from '@/components'。

2. [major] 规则点：简单组件物理边界与升级阈值
   证据：src/components/StatusBadge.vue 同级目录存在专属文件 format-status.ts
   问题说明：简单组件打破了单文件约束，同级散落了私有工具函数，污染了外层目录树。
   改动建议：触发升级阈值。请新建 src/components/StatusBadge/ 目录，将组件移入 src/index.vue，工具移入 src/utils/format-status.ts，并确保 @/components/index.ts 中完成导出。

### 改动建议汇总
- src/components/index.ts：确认 StatusBadge 与 useTableSort 的统一导出。
- src/views/purchase-order/index.vue：第 12 行导入路径由深层包引用改为层级导出 @/components。
- 新建目录 src/components/StatusBadge/src/，移动并重构相关文件。
````
