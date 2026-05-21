---
name: react-module-standard
description: 用于新写或重构 React TypeScript/JavaScript 业务模块、页面模块和领域模块时，按统一模块标准重建目录、共享边界、状态位置和导入约束；允许直接替换旧模块结构，不为历史兼容保留中间层。
---

# React 模块实现标准

## 版本要求

- React 18+（Concurrent Features、Suspense for data fetching）
- React 19+（use hook、ref as prop、Context as provider）
- 低于 19 时，ref 转发使用 `forwardRef`；19+ 直接作为 prop 接收
- 低于 19 时，Context 使用 `<Context.Provider>`；19+ 直接使用 `<Context>`

## 使用场景

当任务目标是新写业务模块、重构页面模块、整理领域目录、收敛共享代码边界，或判断代码应留在模块内还是上浮到共享目录时，使用本 Skill。

本 Skill 面向新实现和重构实现，不面向兼容式修补。模块边界、目录层次、公共代码位置一旦妨碍当前目标，就直接按目标职责重建；不要为了兼容旧调用方保留中间层目录、双路径出口或伪共享目录。

## 工作顺序

1. 先确认模块职责、页面流程、调用方、相邻模块和项目已有目录约定。
2. 判断目标属于 `business-module` 或 `ordinary-module`。
3. 识别哪些代码是模块私有实现，哪些代码满足三次原则并应上浮。
4. 直接按目标职责重建目录、聚合入口、共享边界和状态位置，不保留无价值兼容层。
5. 完成后按风险执行项目已有 lint、tsc、test、build 或浏览器验证；缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

## 实现原则

- 状态就近：模块状态默认留在当前页面、流程或领域内；只有跨模块共享、跨页面保留或业务流程要求时才上浮到 Context 或外部 store。
- 逻辑贴近使用点：模块私有常量、类型、组件和工具默认留在模块内。
- 三次原则：只有满足至少三个独立使用点，才把公共代码上浮到最近公共父级。
- 失败显性：依赖、接口、配置和状态不满足契约时暴露失败，不写静默兜底和伪成功。
- 抽象要付账：不要因为文件变长就机械拆分；拆分必须对应可命名的职责、复用点或测试边界。
- 注释解释意图：只说明模块边界、共享理由、特殊流程或非显然取舍。

## React 模块规范

### Custom Hooks

- custom hook 以 `use` 前缀命名，返回类型明确。
- 模块私有 hook 留在模块内；只有跨模块复用时才上浮。
- hook 不得隐式依赖组件树位置；需要 Context 时显式文档化。
- hook 内部的 `useEffect` 必须有清理函数处理取消订阅和 abort。

### Context 与状态

- Context 只用于跨层级共享不频繁变化的数据（主题、locale、auth、表单上下文）。
- 频繁变化的状态不放 Context，避免不必要的子树重渲染。
- Context value 使用 `useMemo` 稳定引用，或拆分为多个细粒度 Context。
- 提供 custom hook 封装 Context 消费，内含空值检查和错误提示。

### 数据获取

- 数据获取逻辑封装在 custom hook 中，返回 loading、error、data 状态。
- 支持 Suspense 的数据获取方案优先；不支持时 hook 内部管理 loading 状态。
- 请求取消使用 AbortController，在 `useEffect` 清理函数中 abort。

### 路由与页面

- 页面组件作为模块入口，负责组合子组件和管理页面级状态。
- 路由参数通过 router hook 获取，不通过 props 层层传递。
- 页面级 loading 和 error 状态在页面组件处理，不下沉到子组件。

## 模块分类

### business-module

- 根入口使用 `index.tsx` 或 `index.jsx`。
- 围绕一个页面、流程或领域能力组织，而不是围绕技术名词先建目录。
- 模块私有 API、常量、类型、组件和工具默认留在模块内。

### ordinary-module

- 单个模块以实现入口为中心组织，不创建包级公共出口。
- 普通模块根目录不得额外创建 `index.ts` / `index.js` 作为包级公共 API。
- 普通实现目录可用 `index.ts` / `index.js` 做本地聚合，但不得伪装成包级 API。

## 目录与共享边界

- 单个模块不得再嵌套 `src/` 目录。
- 前端目录遵循单一入口、按需拆分。
- `styles/` 只使用一个 `index.css`、`index.scss` 或 `index.less` 作为样式入口。
- 公共代码上浮到最近公共父级；不得跨过最近公共父级直接丢到更高层共享目录。
- 禁止为了兼容旧路径保留重复实现、双目录或中间转发层。

## 导入与类型

- 路径别名优先：跨模块引用或多层级向上查找时，优先使用项目配置的路径别名。
- 禁止 deep import；外部不得穿透到具体实现文件、私有目录或伪共享层。
- 简单类型优先贴近使用点；只有跨文件或跨职责共享时才抽离类型文件。
- 不用 `any`、宽泛对象或可选字段掩盖契约不清。

## 完成前检查

- 模块职责是否清晰，是否还保留了只为兼容旧结构存在的目录或出口。
- 公共代码是否满足三次原则，并且上浮位置是否落在最近公共父级。
- 状态是否就近保留，没有无依据上浮到 Context、外部 store 或 custom hook。
- 是否运行了与风险匹配的现有 lint、tsc、test、build 或浏览器验证。

## SSR/SSG 场景注意事项

使用 Next.js、Remix 或其他 SSR 框架时，模块组织需额外注意：

- 服务端与客户端边界：hook 和状态初始化需区分 `useEffect`（仅客户端）与组件顶层（双端执行）。
- 数据获取：优先使用框架提供的数据获取机制（如 Next.js 的 Server Components、`getServerSideProps`，Remix 的 `loader`），而非在 `useEffect` 中手动请求。
- 浏览器 API：`window`、`document`、`localStorage` 等仅在客户端可用，需用 `typeof window !== 'undefined'` 或 `useEffect` 保护。
- 状态序列化：跨端传递的 props 必须可序列化，不能包含函数、Symbol 或循环引用。
- 路由与中间件：页面级权限和重定向优先使用框架路由机制（如 Next.js middleware、Remix loader redirect），而非组件内判断。
- Server Components（React 19+/Next.js 13+）：区分 Server Component 和 Client Component，Server Component 不能使用 hook 和浏览器 API。

本 Skill 的模块结构规则同样适用于 SSR 项目，但需结合框架约定（如 Next.js 的 `app/`、`pages/`、`components/` 目录）调整具体落点。

## 辅助资源

- 示例：`examples/`
- 校验清单：`validation/checklist.md`
- 结构校验脚本：`scripts/verify-rules.mjs`（覆盖模块结构与最近公共父级约束，不替代实现审查）
