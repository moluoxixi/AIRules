---
name: react-component-standard
description: 用于新写或重构 React TypeScript/JavaScript 组件时，按统一组件标准重建目录、契约、状态边界、类型出口和交付检查；允许直接重写旧实现，不为历史兼容保留冗余结构。
---

# React 组件实现标准

## 版本要求

- React 18+（Concurrent Features、Suspense for data fetching）
- React 19+（use hook、ref as prop、Context as provider）
- 低于 19 时，ref 转发使用 `forwardRef`；19+ 直接作为 prop 接收
- 低于 19 时，Context 使用 `<Context.Provider>`；19+ 直接使用 `<Context>`

## 使用场景

当任务目标是新写 React 组件、重构旧组件、把零散实现收敛为稳定组件包，或判断组件是否应该升级为复杂组件包时，使用本 Skill。

本 Skill 面向新实现和重构实现，不面向兼容式修补。只要旧结构、旧类型出口、旧目录边界妨碍当前目标，就直接按标准重建；不要为了保持历史形态保留冗余壳层、双入口或过渡目录。

## 工作顺序

1. 先确认组件职责、调用方契约、真实交互路径和项目现有 UI 栈。
2. 判断目标属于 `simple-component` 还是 `component-package`。
3. 先复用项目已有 UI 基础设施、hooks、样式体系、校验库和测试工具。
4. 直接按目标职责重建组件结构、公共 API、状态边界和类型出口，不保留无价值兼容层。
5. 完成后按风险执行项目已有 lint、tsc、test、build 或浏览器验证；缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

## 实现原则

- 契约优先：props、ref、callback、render prop 和 children 必须表达真实调用契约。
- 状态就近：组件私有状态留在组件内；只有跨组件共享、跨页面保留或流程边界明确时才上浮到 Context 或外部 store。
- 逻辑贴近使用点：组件私有逻辑默认留在组件内部；只有复用、测试或复杂度收益明确时才抽到 custom hook 或普通函数。
- 失败显性：输入、依赖、配置或运行状态不满足契约时暴露失败，不写静默兜底、空对象兼容或伪成功。
- 类型从事实来：优先从常量、schema、组件契约和库类型推导，避免重复维护手写宽泛类型。
- 抽象要付账：新目录、新 hook、新 wrapper 必须减少至少两个调用方的重复代码或消除一个具体错误类别；不得为了"更像规范"机械拆分。
- 注释解释意图：注释只说明契约、边界、业务例外和非显然取舍，不复述实现步骤。

## React 组件规范

### Function Component

- 默认使用 function component 和 hooks。
- 不使用 class component，除非维护遗留代码或需要 Error Boundary（React 19 前）。
- 组件函数命名使用 PascalCase，hooks 使用 `use` 前缀。

### Props 与类型

- props 使用 TypeScript interface 或 type 声明，命名为 `ComponentNameProps`。
- 必选 prop 不加 `?`，可选 prop 加 `?` 并在解构时提供默认值。
- children 类型使用 `React.ReactNode`；render prop 使用具体函数签名。
- 禁止使用 `any` 作为 prop 类型；不确定时使用 `unknown` 并在组件内收窄。

### Ref 与 Imperative Handle

- React 19+：ref 直接作为 prop 接收，无需 `forwardRef`。
- React 18：需要暴露 DOM 或方法时使用 `forwardRef` + `useImperativeHandle`。
- `useImperativeHandle` 只暴露调用方真正需要的方法，不泄露内部实现。
- 暴露的 ref 类型使用独立 interface，命名为 `ComponentNameRef`。

### Hooks 规则

- hooks 只在组件顶层调用，不在条件、循环或嵌套函数中调用。
- custom hook 必须以 `use` 开头，返回值类型明确。
- 依赖数组必须完整；不用 eslint-disable 绕过 exhaustive-deps。
- `useEffect` 只用于同步外部系统（DOM、订阅、网络）；派生状态用计算或 `useMemo`。

### 派生状态与性能

- 派生状态优先在 render 中直接计算；只有计算开销大时使用 `useMemo`。
- `useMemo`、`useCallback`、`memo` 只用于真实稳定性或性能边界，不为"看起来优化"滥用。
- `memo` 用于子组件 props 稳定但父组件频繁渲染的场景。
- 避免在 render 中创建新对象/数组作为 prop，除非子组件不依赖引用稳定性。

### 受控与非受控

- 表单组件默认受控：value + onChange。
- 非受控组件使用 `defaultValue` + ref 获取值。
- 同一组件不混用受控和非受控模式；混用时抛出开发环境警告。

### Error Boundary

- 使用 Error Boundary 包裹可能抛错的子树，提供 fallback UI。
- Error Boundary 粒度按功能区域划分，不要整个应用只用一个。
- React 19+：可使用函数式 Error Boundary 方案。

### Suspense 与异步

- 异步数据加载使用 Suspense + 支持 Suspense 的数据获取方案。
- `React.lazy` 用于路由级或大型组件的代码分割。
- Suspense fallback 提供有意义的 loading 状态，不要空白。

### Context

- Context 只用于跨层级共享不频繁变化的数据（主题、locale、auth）。
- 频繁变化的状态不放 Context，避免不必要的子树重渲染。
- Context value 使用 `useMemo` 稳定引用，或拆分为多个细粒度 Context。
- 提供 custom hook 封装 Context 消费，内含空值检查和错误提示。

### 生命周期与副作用

- `useEffect` 清理函数必须取消订阅、清除定时器、abort 请求。
- `useLayoutEffect` 只用于需要同步测量 DOM 的场景。
- 避免 `useEffect` 链式触发状态更新（effect → setState → effect）。

## 组件分类

### simple-component

- 直接使用 `ComponentName.tsx` 或 `ComponentName.jsx`。
- 适用于职责单一、私有逻辑少、无独立包级 API 的组件。
- 简单组件优先保持单文件；不要为了预防未来复杂度提前升级结构。

### component-package

- 使用根 `README.md`、`index.ts` / `index.js` 和 `src/`。
- 根入口只暴露稳定公共 API；内部实现留在 `src/`。
- `src/` 下只能保留一个实现入口：`index.tsx` 或 `index.jsx`。
- README 必须说明使用方式、公开契约（props、ref、children、render props）、主要状态和限制条件。

## 组件标准

- 组件只对外暴露必要能力；不要把内部实现、临时状态或工具函数泄露成公共 API。
- 交互组件必须覆盖当前职责下真实存在的 loading、disabled、empty、error、readonly、focused 等状态。
- 表单组件必须明确受控/非受控模型、校验触发时机和错误展示来源。
- 可访问性交互必须包含语义元素、键盘路径、焦点管理和必要 ARIA。
- 样式优先使用项目已有样式体系（CSS Modules、Tailwind、styled-components、UnoCSS）；同一项目不混用多种样式方案。

## 类型与导入

- 简单组件的类型优先贴近使用点，写在同一文件内。
- 复杂组件可按职责拆分 `types/props.ts`、`types/ref.ts`、`types/context.ts` 和 `types/index.ts`。
- 类型出口优先使用 type-only re-export，例如 `export type * from './props'`。
- 路径别名优先；外部调用方只能通过公开入口导入。
- 禁止 deep import，不得穿透到组件内部 `src/`、私有目录或具体实现文件。

## 性能边界

- 大列表（100+ 项）使用虚拟滚动或分页，不要一次性渲染全部 DOM。
- 重计算逻辑使用 `useMemo` 缓存，避免每次 render 重复计算。
- 大型子树使用 `memo` 或状态下沉减少不必要的重渲染。
- 非首屏组件使用 `React.lazy` + `Suspense` 动态导入。

## 完成前检查

- 组件职责是否清晰，是否还保留了只为兼容旧实现存在的目录或 API。
- 状态、交互、错误、空态和禁用态是否覆盖当前需求。
- 公开类型和导入路径是否经过公开入口，是否避免 deep import。
- 是否运行了与风险匹配的现有 lint、tsc、test、build 或浏览器验证。

## 辅助资源

- 示例：`examples/`
- 校验清单：`validation/checklist.md`
- 结构校验脚本：`scripts/verify-rules.mjs`（只覆盖组件结构约束，不替代实现审查）
