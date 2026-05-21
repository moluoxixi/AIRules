---
name: vue-module-standard
description: 用于新写或重构 Vue 3 TypeScript/JavaScript 业务模块、页面模块和领域模块时，按统一模块标准重建目录、共享边界、状态位置和导入约束；允许直接替换旧模块结构，不为历史兼容保留中间层。
---

# Vue 模块实现标准

## 版本要求

- Vue 3.4+（`defineModel` 支持）
- Vue 3.5+（`useTemplateRef` 支持）
- 低于 3.4 时，`v-model` 使用 `modelValue` / `update:modelValue` 手写
- 低于 3.5 时，模板 ref 使用 `ref()` + 模板 `ref="xxx"` 手写

## 使用场景

当任务目标是新写业务模块、重构页面模块、整理领域目录、收敛共享代码边界，或判断代码应留在模块内还是上浮到共享目录时，使用本 Skill。

本 Skill 面向新实现和重构实现，不面向兼容式修补。模块边界、目录层次、公共代码位置一旦妨碍当前目标，就直接按目标职责重建；不要为了兼容旧调用方保留中间层目录、双路径出口或伪共享目录。

## 工作顺序

1. 先确认模块职责、页面流程、调用方、相邻模块和项目已有目录约定。
2. 判断目标属于 `business-module` 或 `ordinary-module`。
3. 识别哪些代码是模块私有实现，哪些代码满足三次原则并应上浮。
4. 直接按目标职责重建目录、聚合入口、共享边界和状态位置，不保留无价值兼容层。
5. 完成后按风险执行项目已有 lint、vue-tsc、test、build 或浏览器验证；缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

## 实现原则

- 状态就近：模块状态默认留在当前页面、流程或领域内；只有跨模块共享、跨页面保留或业务流程要求时才上浮到 store 或 provide/inject。
- 逻辑贴近使用点：模块私有常量、类型、组件和工具默认留在模块内。
- 三次原则：只有满足至少三个独立使用点，才把公共代码上浮到最近公共父级。
- 失败显性：依赖、接口、配置和状态不满足契约时暴露失败，不写静默兜底和伪成功。
- 抽象要付账：不要因为文件变长就机械拆分；拆分必须对应可命名的职责、复用点或测试边界。
- 注释解释意图：只说明模块边界、共享理由、特殊流程或非显然取舍。

## Vue 模块规范

### Composition API

- 模块页面和组件默认使用 `<script setup>`。
- `defineProps`、`defineEmits`、`defineSlots`、`defineExpose` 的类型与运行时行为必须一致。

### v-model

- props 默认值优先使用 `withDefaults(defineProps(...), ...)`，避免在模块页面或业务逻辑层补伪默认值。
- 标准双向绑定优先使用 `defineModel`（Vue 3.4+），减少 `modelValue` / `update:modelValue` 样板并保持契约集中。

### 模板 ref

- 模板 ref 优先使用 `useTemplateRef`（Vue 3.5+）；只有工具链或场景限制不支持时才回退到 `ref()`。

### 响应式

- `computed` 用于派生状态，`watch` 用于同步外部副作用，不用 `watch` 复制可计算状态。
- `watchEffect` 用于自动追踪依赖的副作用；明确依赖时优先 `watch`。
- `shallowRef`、`shallowReactive` 用于大对象或外部实例，避免深度响应式开销。

### provide/inject

- 只用于跨层级组件通信，不用于替代 props 传递。
- 必须提供 InjectionKey 类型和默认值或显式错误。
- 避免 provide 可变对象导致的隐式依赖。

### Composables

- composable 以 `use` 前缀命名，返回响应式状态或方法。
- 模块私有 composable 留在模块内；只有跨模块复用时才上浮。
- composable 不得隐式依赖组件实例；需要生命周期时显式文档化。

## 模块分类

### business-module

- 根入口使用 `index.vue`。
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
- 状态是否就近保留，没有无依据上浮到 store、provide/inject 或 composable。
- 是否运行了与风险匹配的现有 lint、vue-tsc、test、build 或浏览器验证。

## SSR/SSG 场景注意事项

使用 Nuxt 或其他 SSR 框架时，模块组织需额外注意：

- 服务端与客户端边界：composable 和状态初始化需区分 `onMounted`（仅客户端）与 `setup`（双端执行）。
- 数据获取：优先使用框架提供的数据获取机制（如 Nuxt 的 `useFetch`、`useAsyncData`），而非在 `onMounted` 中手动请求。
- 浏览器 API：`window`、`document`、`localStorage` 等仅在客户端可用，需用 `import.meta.client` 或 `onMounted` 保护。
- 状态序列化：跨端传递的状态必须可序列化，不能包含函数、Symbol 或循环引用。
- 路由与中间件：页面级权限和重定向优先使用框架路由中间件，而非组件内判断。

本 Skill 的模块结构规则同样适用于 SSR 项目，但需结合框架约定（如 Nuxt 的 `pages/`、`composables/`、`server/` 目录）调整具体落点。

## 辅助资源

- 示例：`examples/`
- 校验清单：`validation/checklist.md`
- 结构校验脚本：`scripts/verify-rules.mjs`（覆盖模块结构与最近公共父级约束，不替代实现审查）
