---
name: frontend-component-standard
description: 用于新写或重构 Vue 3 / React TypeScript/JavaScript 组件时，按统一组件标准重建目录、契约、状态边界、类型出口和交付检查；允许直接重写旧实现，不为历史兼容保留冗余结构。
---

# 前端组件实现标准

## 使用场景

当任务目标是新写组件、重构旧组件、把零散实现收敛为稳定组件包，或判断组件是否应该升级为复杂组件包时，使用本 Skill。

本 Skill 面向新实现和重构实现，不面向兼容式修补。只要旧结构、旧类型出口、旧目录边界妨碍当前目标，就直接按标准重建；不要为了保持历史形态保留冗余壳层、双入口或过渡目录。

## 工作顺序

1. 先确认组件职责、调用方契约、真实交互路径和项目现有 UI 栈。
2. 判断目标属于 `simple-component` 还是 `component-package`。
3. 先复用项目已有 UI 基础设施、hooks、composables、样式体系、校验库和测试工具。
4. 直接按目标职责重建组件结构、公共 API、状态边界和类型出口，不保留无价值兼容层。
5. 完成后按风险执行项目已有 lint、typecheck、test、build 或浏览器验证；缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

## 实现原则

- 契约优先：props、emits、slots、expose、ref、render prop 和回调必须表达真实调用契约。
- 状态就近：组件私有状态留在组件内；只有跨组件共享、跨页面保留或流程边界明确时才上浮。
- 逻辑贴近使用点：组件私有逻辑默认留在组件内部；只有复用、测试或复杂度收益明确时才抽到 hook、composable 或普通函数。
- 失败显性：输入、依赖、配置或运行状态不满足契约时暴露失败，不写静默兜底、空对象兼容或伪成功。
- 类型从事实来：优先从常量、schema、组件契约和库类型推导，避免重复维护手写宽泛类型。
- 抽象要付账：新目录、新 hook、新 wrapper 必须减少真实复杂度；不得为了“更像规范”机械拆分。
- 注释解释意图：注释只说明契约、边界、业务例外和非显然取舍，不复述实现步骤。

## Vue 3 标准

- 默认使用 Composition API 和 `<script setup>`。
- `defineProps`、`defineEmits`、`defineSlots`、`defineExpose` 的类型与运行时行为必须一致。
- props 默认值优先使用 `withDefaults(defineProps(...), ...)`，不要在业务逻辑里用二次合并或 `??`/`||` 伪造默认契约。
- 组件需要标准 `v-model` 契约时优先使用 `defineModel`；只有多路 model、第三方契约或现有项目约定明确要求时，才回到手写 `modelValue` / `update:modelValue`。
- 模板 ref 优先使用 `useTemplateRef`；只有当前 Vue 版本、工具链或非模板场景不支持时，才退回 `ref()`。
- `computed` 用于派生状态，`watch` 用于同步外部副作用，不用 `watch` 复制可计算状态。
- 模板只保留可读的展示与绑定；复杂映射、格式化和条件判断放回脚本区的具名计算或函数。

## React 标准

- 默认使用 function component 和 hooks。
- props、ref、callback 和 render prop 的类型必须表达真实调用契约。
- 派生状态优先在 render 或 memo 中计算，不用 effect 复制同步。
- `useMemo`、`useCallback`、`memo` 只用于真实稳定性或性能边界，不为“看起来优化”滥用。

## 组件分类

### simple-component

- 直接使用 `ComponentName.vue`、`ComponentName.tsx` 或 `ComponentName.jsx`。
- 适用于职责单一、私有逻辑少、无独立包级 API 的组件。
- 简单组件优先保持单文件；不要为了预防未来复杂度提前升级结构。

### component-package

- 使用根 `README.md`、`index.ts` / `index.js` 和 `src/`。
- 根入口只暴露稳定公共 API；内部实现留在 `src/`。
- `src/` 下只能保留一个实现入口：`index.vue`、`index.tsx` 或 `index.jsx`。
- README 必须说明使用方式、公开契约、主要状态和限制条件。

## 组件标准

- 组件只对外暴露必要能力；不要把内部实现、临时状态或工具函数泄露成公共 API。
- 交互组件必须覆盖当前职责下真实存在的 loading、disabled、empty、error、readonly、focused 等状态。
- 表单组件必须明确受控/非受控模型、校验触发时机和错误展示来源。
- 可访问性交互必须包含语义元素、键盘路径、焦点管理和必要 ARIA。
- 样式只服务状态表达和布局稳定性；不要靠魔法数字掩盖结构问题。

## 类型与导入

- 简单组件的类型优先贴近使用点。
- 复杂组件可按职责拆分 `types/props.ts`、`types/emit.ts`、`types/expose.ts`、`types/ref.ts` 和 `types/index.ts`。
- 类型出口优先使用 type-only re-export，例如 `export type * from './props'`。
- 路径别名优先；外部调用方只能通过公开入口导入。
- 禁止 deep import，不得穿透到组件内部 `src/`、私有目录或具体实现文件。

## 完成前检查

- 组件职责是否清晰，是否还保留了只为兼容旧实现存在的目录或 API。
- 状态、交互、错误、空态和禁用态是否覆盖当前需求。
- 公开类型和导入路径是否经过公开入口，是否避免 deep import。
- 是否运行了与风险匹配的现有 lint、typecheck、test、build 或浏览器验证。

## 辅助资源

- 示例：`examples/`
- 校验清单：`validation/checklist.md`
- 结构校验脚本：`scripts/verify-rules.mjs`（只覆盖组件结构约束，不替代实现审查）
