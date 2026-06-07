---
name: components-docs
description: 用于生成或更新组件库提供方 docs/out-components 或组件消费方 docs/components 文档，尤其是组件库、外部 UI 依赖、Props/Events/Slots、交互状态、可访问性或示例用法需要落文档时触发。
---

# Components Docs

## 输出位置

- 提供方文档：`docs/out-components/<组件名>.md`
- 提供方索引：`docs/out-components/index.md`
- 消费方文档：`docs/components/<组件库或组件名>.md`
- 消费方索引：`docs/components/index.md`
- 地图路径：`docs/map.md`
- `docs/out-components/` 是当前项目作为组件库提供给其它项目复用的组件契约。
- `docs/components/` 是当前项目消费外部组件库、Design System、UI SDK 或 workspace 组件包时的使用约束；不得作为 `docs/out-components/` 镜像目录。

## 模式选择

- Provider mode：当前项目或 monorepo 子项目是 `component-library`、Design System、UI SDK 或对外发布组件包时启用；输出当前项目自己的组件到 `docs/out-components/`。
- Consumer mode：当前项目依赖外部组件库、Design System、UI SDK 或 workspace 组件包时启用；输出本项目如何使用外部组件到 `docs/components/`。
- 同一仓库可以同时存在 provider mode 与 consumer mode；必须按项目根和组件归属分别处理，不得把当前项目自己的组件写入 `docs/components/`。
- 已有组件文档必须先判定归属：能匹配当前组件库源码、入口导出、类型或测试的，转为 `docs/out-components/`；能匹配依赖包名、源码 import、全局注册或主题配置的，转为 `docs/components/`；无法确认时标记 `MISSING component ownership` 并保留来源路径。

## 组件发现

未指定组件名时，不得直接询问用户要写哪个组件；必须先由 AI 扫描组件库项目并推导组件清单：

- 优先读取 `detect-stack.mjs` 输出的 `projects`、`projectRoots` 与 `evidence`，定位 `component-library` 与 `component-consumer` 子项目；再用 CodeGraph、`rg` 或文件读取分析组件源码、入口导出、`src/components/`、`components/`、依赖包、源码 import、Props/Events/Slots/Children、示例和测试。
- `scripts/discover-components.mjs` 只能作为候选组件清单辅助工具；不得把脚本输出当作文档事实来源，也不得因为脚本不可用或结果为空就停止推导。
- 组件库项目中发现的所有组件都必须输出到 `docs/out-components/`，包括 `src/components/`、`components/` 和组件库入口导出的组件；不得只写公共导出组件，也不得让用户手动挑选组件。
- 组件消费项目中发现的外部组件库依赖、workspace UI 包、全局注册组件和封装适配层必须输出到 `docs/components/`；普通前端应用中的业务组件不写入 `docs/components/` 或 `docs/out-components/`。
- 发现到当前项目自己的组件库组件时，逐个生成或更新 `docs/out-components/<组件名>.md`，并同步 `docs/out-components/index.md` 与 `docs/map.md`。
- 发现到当前项目消费的外部组件库或 workspace UI 包时，按组件库或稳定组件名生成或更新 `docs/components/<组件库或组件名>.md`，并同步 `docs/components/index.md` 与 `docs/map.md`。
- 未发现组件时，报告 `MISSING components discovery`，说明已扫描的项目根、组件目录和入口文件；不得在扫描前反问组件名。
- 用户明确指定组件名时，仍需先校验该组件是否存在于组件库发现结果中；找不到时报告 `MISSING component source`。
- 文档内容必须由 AI 阅读源码和已有文档后推导生成；脚本不得生成 Props、事件、插槽、状态、可访问性或示例等文档正文。

## 写作规则

- 先读取已存在的 `docs/map.md`、`docs/out-components/index.md`、`docs/components/index.md`、相关 PRD、架构文档、组件源码、依赖声明和已有组件文档；目标目录或索引不存在时创建，不得因缺失停止。
- 只描述组件对外契约，不暴露内部实现细节；内部实现变化不应影响文档契约。
- 必须覆盖 Props、事件/回调、插槽/children、状态、可访问性、示例和测试建议。
- 根据已有组件库源码生成或更新 `docs/out-components/` 是实时对外输出，不属于 L2，不得先输出报告等待确认，也不得以评审门槛为由跳过。
- 根据已有外部组件库依赖、源码 import、主题配置、封装适配层或旧文档生成 `docs/components/` 是消费方知识整理，不属于 L2，不得先输出报告等待确认。
- 源码、类型、测试、示例或已有文档无法确认的信息，必须在对应组件文档中标记 `MISSING` 并说明缺口。
- 只有用户要求修改组件库代码、重新设计公共契约或改变组件库分类时，才进入代码实现或设计评审；评审不得阻塞本 skill 对已存在源码事实的文档输出。
- 仅补充既有组件的已确认示例、字段说明或变更记录时，可按 L0 直接更新。
- 更新或新增提供方文档后，同步更新 `docs/out-components/index.md` 的组件清单、`来源快照` 和 `docs/map.md`。
- 更新或新增消费方文档后，同步更新 `docs/components/index.md` 的组件库清单、依赖版本、来源证据和 `docs/map.md`。
- `来源快照` 记录在 `docs/out-components/index.md`，包含 `sourceCommit`、`sourceState`、`generatedBy`、`sourceRoots` 和关键 `sourceFiles`。
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
