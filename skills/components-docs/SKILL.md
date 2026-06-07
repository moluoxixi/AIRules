---
name: components-docs
description: 用于生成或更新组件库 out-components 与 docs/components 文档，尤其是组件库、公共组件、Props/Events/Slots、交互状态、可访问性或示例用法需要落文档时触发。
---

# Components Docs

## 输出位置

- 对外文档：`out-components/<组件名>.md`
- 对外索引：`out-components/index.md`
- 内部知识库：`docs/components/<组件名>.md`、`docs/components/index.md`
- 地图路径：`docs/map.md`
- `out-components/` 是给其它项目、AI 或消费方复用的组件契约；`docs/components/` 只作为项目内部知识库入口，二者不得出现冲突。

## 组件发现

未指定组件名时，不得直接询问用户要写哪个组件；必须先由 AI 扫描组件库项目并推导组件清单：

- 优先读取 `detect-stack.mjs` 输出的 `projects`、`projectRoots` 与 `evidence`，定位 `component-library` 子项目；再用 CodeGraph、`rg` 或文件读取分析组件源码、入口导出、`src/components/`、`components/`、Props/Events/Slots/Children、示例和测试。
- `scripts/discover-components.mjs` 只能作为候选组件清单辅助工具；不得把脚本输出当作文档事实来源，也不得因为脚本不可用或结果为空就停止推导。
- 组件库项目中发现的所有组件都必须输出到 `out-components/`，包括 `src/components/`、`components/` 和组件库入口导出的组件；不得只写公共导出组件，也不得让用户手动挑选组件。
- monorepo 或 workspace 项目只处理组件库子项目；普通前端应用中的业务组件不写入 `out-components/` 或 `docs/components/`。
- 发现到组件时，逐个生成或更新 `out-components/<组件名>.md`；若项目维护 `docs/components/`，同步内部组件文档、`docs/components/index.md` 与 `docs/map.md`。
- 未发现组件时，报告 `MISSING components discovery`，说明已扫描的项目根、组件目录和入口文件；不得在扫描前反问组件名。
- 用户明确指定组件名时，仍需先校验该组件是否存在于组件库发现结果中；找不到时报告 `MISSING component source`。
- 文档内容必须由 AI 阅读源码和已有文档后推导生成；脚本不得生成 Props、事件、插槽、状态、可访问性或示例等文档正文。

## 写作规则

- 先读取已存在的 `docs/map.md`、`docs/components/index.md`、`out-components/index.md`、相关 PRD、架构文档、组件源码和已有组件文档；目标目录或索引不存在时创建，不得因缺失停止。
- 只描述组件对外契约，不暴露内部实现细节；内部实现变化不应影响文档契约。
- 必须覆盖 Props、事件/回调、插槽/children、状态、可访问性、示例和测试建议。
- 根据已有组件库源码生成或更新 `out-components/` 是实时对外输出，不属于 L2，不得先输出报告等待确认，也不得以评审门槛为由跳过。
- 源码、类型、测试、示例或已有文档无法确认的信息，必须在对应组件文档中标记 `MISSING` 并说明缺口。
- 只有用户要求修改组件库代码、重新设计公共契约或改变组件库分类时，才进入代码实现或设计评审；评审不得阻塞本 skill 对已存在源码事实的文档输出。
- 仅补充既有组件的已确认示例、字段说明或变更记录时，可按 L0 直接更新。
- 更新或新增文档后，同步更新 `out-components/index.md` 的组件清单和 `来源快照`；若项目维护内部知识库，同步 `docs/components/index.md` 和 `docs/map.md`。
- `来源快照` 记录在 `out-components/index.md`，包含 `sourceCommit`、`sourceState`、`generatedBy`、`sourceRoots` 和关键 `sourceFiles`。
- 工作区 clean 且 Git 可用时，`sourceCommit` 使用当前 `HEAD`；工作区 dirty 或无法确认提交时，必须标记 `sourceState: dirty` 或 `MISSING source commit`，并列出影响本次文档的已修改源码文件。
- 单个组件文档只记录源码路径、导出入口、测试和示例来源，不重复记录 commit ID。

## 文档结构

```md
# <组件名>组件文档

## 用途

## 引入

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|

## 事件与回调

## 插槽或 Children

## 状态

## 可访问性

## 示例

## 测试建议

## 变更记录
```

## 示例

````md
# Button组件文档

## 用途

用于触发表单提交、页面动作或工具栏命令。

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| variant | `primary/secondary/danger` | `primary` | 否 | 按钮视觉优先级 |
| disabled | `boolean` | `false` | 否 | 禁用交互 |

## 事件与回调

| 名称 | 触发时机 |
|---|---|
| onClick | 用户点击且按钮未禁用 |

## 可访问性

- 图标按钮必须提供 `aria-label`。
- 禁用态必须阻止点击回调。

## 示例

```tsx
<Button variant="primary" onClick={submitPurchaseOrder}>
  提交采购订单
</Button>
```
````
