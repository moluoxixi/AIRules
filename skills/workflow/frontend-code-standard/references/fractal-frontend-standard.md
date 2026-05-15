# Vue 3 与 TypeScript 分形前端规范

## 1. 核心原则：分形递归与就近原则

每一个复杂组件（如 `components/DataTable`）或业务模块（如 `views/purchaseOrder`）都必须视为高度自治的微型应用。

- 禁止扁平化：不得将模块专用的类型、工具类或 composable 提升到全局 `src/types`、`src/utils` 或 `src/composables`。
- 就近原则：类型、常量、API 定义、纯函数、状态逻辑和私有子组件必须优先放在当前处理组件或模块最近的目录内。
- 递归结构：组件内部的子组件必须拥有与父级完全一致的目录层级能力，可继续包含自己的 `types/`、`constants/`、`utils/`、`composables/`、`components/` 和 `api/`。

## 2. 标准模块骨架

创建新的业务视图或复杂组件时，必须使用以下骨架；不要创建没有对应职责的空目录。

```text
[ModuleName]/
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
    index.ts
  utils/
    index.ts
  index.ts
```

如项目使用 TSX，可将 `index.vue` 替换为 `index.tsx`；如项目已统一使用 `hooks/`，可将 `composables/` 替换为 `hooks/`，但同一模块内不得混用两套命名。

业务模块示例：

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

复杂组件示例：

```text
components/
  DataTable/
    index.vue
    api/
      index.ts
    components/
      index.ts
      ColumnSettings/
        index.vue
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
      props.ts
      emit.ts
      expose.ts
      index.ts
    utils/
      index.ts
    index.ts
```

`AuditDialog/` 和 `ColumnSettings/` 不是扁平子文件，而是可继续递归扩展的独立组件模块。复杂组件和业务视图使用同一套内部组织能力；差异只在放置位置和业务语义，不允许为复杂组件创建一套扁平化特例。

目录职责：

- `index.vue` 或 `index.tsx`：主视图或主组件入口，只负责组装渲染和事件装配。
- `api/`：仅限当前模块调用的接口定义、请求函数和请求层适配。
- `components/`：当前模块私有子组件，子组件可继续递归本结构。
- `composables/` 或 `hooks/`：当前模块私有状态、派生状态、数据加载、校验编排和业务动作。
- `constants/`：当前模块私有常量、字典、配置和稳定映射。
- `types/`：当前模块私有类型定义；复杂 Vue 组件类型必须按 `props.ts`、`emit.ts`、`expose.ts` 拆分。
- `utils/`：当前模块私有纯函数与工具。
- `index.ts`：当前模块或功能集目录的唯一公共出口。

## 3. 组件类型细粒度拆分规则

复杂 Vue 组件的类型必须从视图文件中抽离到当前组件的 `types/` 目录，并按职责切割。

```text
AuditDialog/
  index.vue
  types/
    props.ts
    emit.ts
    expose.ts
    index.ts
```

- `props.ts`：仅定义组件 Props 接口。
- `emit.ts`：仅定义组件 Emits 接口。
- `expose.ts`：仅定义组件对外暴露（`defineExpose`）的实例方法与属性接口。
- `index.ts`：必须统一导出上述所有类型。

```ts
// types/index.ts
export type * from './props'
export type * from './emit'
export type * from './expose'
```

外部导入类型时必须导入 `types/` 目录入口。

```ts
import type { AuditDialogProps } from './types'
```

不得穿透到具体类型文件。

```ts
import type { AuditDialogProps } from './types/props'
```

## 4. 强制统一导出原则

任意层级下的功能集目录，包括 `components/`、`composables/`、`hooks/`、`types/`、`utils/`、`constants/` 和 `api/`，必须提供 `index.ts` 作为该目录唯一对外 API 入口。

目录内新增任何子文件后，必须立即在同级 `index.ts` 中显式导出。

```ts
// utils/index.ts
export * from './object'
```

```ts
// components/index.ts
export { default as AuditDialog } from './AuditDialog'
```

## 5. Deep Imports 零容忍

任何模块在引用同级目录或其他模块暴露资源时，路径必须且只能止步于该资源所在的根目录名称，并默认命中 `index.ts`。

禁止生成：

```ts
import { formatDate } from '../../utils/date'
import type { AuditProps } from '../types/props'
```

必须生成：

```ts
import { formatDate } from '../../utils'
import type { AuditProps } from '../types'
```

输出 `import` 语句时，如果路径包含两层以上相对路径（例如 `../../`），必须立即核对是否破坏了统一导出原则或发生跨域调用。

## 6. 高内聚与三次法则

业务逻辑和状态默认属于组件或模块的私有财产，必须尽可能内聚。

- 状态局部闭环：新的状态或业务逻辑首选写在组件内部。
- 复杂逻辑就近抽离：当逻辑变复杂时，只能抽离到该组件所在目录下的 `composables/` 或 `hooks/`。
- 外部模块只负责传递指令与数据，不得干预组件内部中间状态流转。

绝对禁止过早抽象。只有明确发现同一段代码或状态被至少 3 个完全不同的顶层模块，或至少 3 个无直接父子关系的组件重复消费时，才允许上浮到全局公共目录。

写入全局 `src/stores`、`src/composables`、`src/hooks`、`src/utils` 或 `src/types` 前，必须验证该逻辑是否已被 3 个独立场景消费；不满足时必须留在最近的业务模块或组件目录。

## 7. 依赖流向限制

- 自上而下：父级模块只能导入其内部子目录通过 `index.ts` 暴露的内容。
- 禁止同级跨域：模块 A 严禁直接导入模块 B 内部的私有文件。
- 禁止穿透封装：跨模块协作只能依赖目标模块 `index.ts` 暴露的公共 API。

## 8. Vue 组件入口边界

复杂组件的 `index.vue` 只负责视图组装、事件装配和对私有 composable 的调用；不得把大量状态流转、数据加载、接口适配或纯工具逻辑堆进 `<script setup>`。

```vue
<script setup lang="ts">
import { useAuditDialog } from './composables'
import type { AuditDialogEmits, AuditDialogExpose, AuditDialogProps } from './types'

const props = defineProps<AuditDialogProps>()
const emit = defineEmits<AuditDialogEmits>()

const dialog = useAuditDialog(props, emit)

defineExpose<AuditDialogExpose>({
  open: dialog.open,
  close: dialog.close,
})
</script>
```

父级模块只负责向子组件传递指令与数据，不得直接干预子组件内部中间状态流转。子组件状态若需要被外部使用，必须通过明确的 Props、Emits 或 `defineExpose` 契约暴露。

## 9. 执行自检

每次输出文件路径或生成代码前，必须在内部完成以下检查，不输出自检过程。

- 辅助函数和类型是否严格放进当前处理组件最近的 `utils/` 或 `types/` 目录。
- 复杂组件接口是否按 `props.ts`、`emit.ts`、`expose.ts` 拆分，并由 `types/index.ts` 导出。
- import 语句是否全部指向目标 Barrel 入口，没有穿透到深层具体文件。
- 是否违反三次法则，在没有 3 个以上独立调用场景的情况下擅自把代码提到全局目录。
