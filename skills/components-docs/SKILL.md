---
name: components-docs
description: 用于生成或更新组件契约文档时触发。两类：消费方 docs/components 记录外部提供给本项目消费的组件库（如 Element Plus、Ant Design、内部 UI SDK）的使用约束；提供方 docs/out-components 记录本项目自己开发对外发布的组件库契约。涉及外部 UI 依赖、Props/Events/Slots、交互状态、可访问性或示例用法落文档时触发；纯业务/页面私有组件不触发。
---

# Components Docs

## 触发条件

- 用户要求生成、更新或标准化组件库提供方/消费方文档时使用。
- 组件库、外部 UI 依赖、Props/Events/Slots、交互状态、可访问性或示例用法需要落文档时使用。

## 不适合场景

- 普通业务组件、页面私有组件或只需要改 UI 代码时不要使用。
- 当前项目自己拼装的业务组件（如基于 Element Plus 二次封装的业务弹框、业务表格）不写入 `docs/components/` 也不写入 `docs/out-components/`；`docs/components/` 只记录外部提供给本项目消费的组件库（如 Element Plus、Ant Design、内部 UI SDK、workspace 组件包）如何使用。
- 脚本未发现组件或文档来源冲突时，不要猜测契约；标记 `MISSING` 并列出证据缺口。

## 概念区分（先判定再写）

- `docs/components/`（消费方）：外部提供给本项目、本项目依赖消费的组件库（element-plus 等），记录「本项目如何使用这些外部组件」的约束与封装规则。组件契约以外部组件库为准，本项目不拥有其契约。
- `docs/out-components/`（提供方）：本项目自己开发、对外发布给其它项目/消费方复用的组件库，记录本项目自己组件的对外契约。
- 二者按组件归属严格区分：外部依赖来的组件 → 消费方；本项目自产对外的组件 → 提供方；纯业务/页面私有组件 → 都不写。

## 输出边界

- 只写 `docs/components/`、`docs/out-components/`、对应索引和 `docs/map.md`。
- 不修改组件源码、Design System 设计、第三方文档或 vendor 目录。

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
- 已有组件文档必须先判定归属和维护来源：能匹配当前组件库源码、入口导出、类型、测试或示例的自维护文档，优先作为 provider 文档来源；能匹配依赖包名、源码 import、全局注册、主题配置或封装适配层的外部组件库文档，优先作为 consumer 文档来源；无法确认时标记 `MISSING component ownership` 并保留来源路径。

## 文档来源与组件发现

未指定组件名时，不得直接询问用户要写哪个组件；必须先由 AI 读取组件库自维护文档和项目事实，再决定是否需要扫描补齐：

- 自维护文档优先：先读取 `docs/out-components/`、包内 `docs/`、Storybook/MDX、示例页、README、变更记录和已有组件文档；这些文档能对应当前组件库公开组件时，不得用源码扫描结果覆盖其契约口径。
- 合规校验优先级高于来源优先级：自维护文档不符合本 skill 的输出位置、文档结构、必备字段、来源证据或 `MISSING` 语义时，必须标准化到 `docs/out-components/` 或 `docs/components/`；不得因为文档由组件库维护就直接判定合格。
- 扫描用于校验和缺口补齐：再读取 `detect-stack.mjs` 输出的 `projects`、`projectRoots` 与 `evidence`，定位 `component-library` 与 `component-consumer` 子项目；用 CodeGraph、`rg` 或文件读取核对组件源码、入口导出、`src/components/`、`components/`、依赖包、源码 import、Props/Events/Slots/Children、示例和测试。
- `scripts/discover-components.mjs` 只能作为候选组件清单和覆盖率核对工具；不得把脚本输出当作文档事实来源，也不得因为脚本不可用或结果为空就停止推导。
- 组件库已有自维护文档时，以合规后的自维护文档清单作为 `docs/out-components/` 的主要输出清单；扫描发现公开导出组件但文档缺失时，才为该组件补齐文档或在索引中标记 `MISSING component docs coverage`。
- 组件库没有可用自维护文档时，基于源码、入口导出、类型、测试和示例生成或更新 `docs/out-components/<组件名>.md`，并同步 `docs/out-components/index.md` 与 `docs/map.md`。
- 扫描发现源码、类型、测试或导出入口与自维护文档冲突时，不得静默改写文档；必须标记 `MISSING component docs drift`，列出冲突证据和待确认字段。
- 组件消费项目优先读取外部组件库官方文档、依赖包自维护文档和本项目已有封装规则；扫描依赖、workspace UI 包、全局注册组件、源码 import 和封装适配层只用于核对实际使用范围和补齐本项目约束。
- 发现到当前项目消费的外部组件库或 workspace UI 包且本项目没有可用消费方文档时，按组件库或稳定组件名生成或更新 `docs/components/<组件库或组件名>.md`，并同步 `docs/components/index.md` 与 `docs/map.md`。
- 普通前端应用中的业务组件不写入 `docs/components/` 或 `docs/out-components/`。
- 未发现自维护文档或组件事实时，报告 `MISSING components discovery`，说明已检查的文档入口、项目根、组件目录和入口文件；不得在扫描前反问组件名。
- 用户明确指定组件名时，仍需先校验该组件是否存在于自维护文档或组件库发现结果中；找不到时报告 `MISSING component source`。
- 文档内容必须由 AI 阅读自维护文档、源码和测试后推导生成；脚本不得生成 Props、事件、插槽、状态、可访问性或示例等文档正文。

## 写作规则

- 先读取已存在的 `docs/map.md`、`docs/out-components/index.md`、`docs/components/index.md`、相关 PRD、架构文档、组件库自维护文档、组件源码、依赖声明和已有组件文档；目标目录或索引不存在时创建，不得因缺失停止。
- 只描述组件对外契约，不暴露内部实现细节；内部实现变化不应影响文档契约。
- 变更分级（L0/L1/L2）与澄清门禁的统一定义见项目 `AGENTS.md` 的「变更分级与确认门禁」「澄清门禁」两节；本 skill 的分级判定以该定义为准。
- 命中澄清门禁时（组件归属、公共契约、Props/事件/插槽、交互状态、可访问性、示例适用范围或测试建议缺少明确来源或存在歧义），必须先输出《组件契约澄清问题清单》，用苏格拉底式问题逐项暴露使用目标、消费者角色、契约边界、状态变化、兼容性、可访问性和破坏性变更风险；未确认内容必须标记为 `MISSING`，澄清未闭环前不得定稿。
- 必须覆盖 Props、事件/回调、插槽/children、状态、可访问性、示例和测试建议。
- 自维护文档缺少上述章节、字段口径、示例、测试建议、来源路径或索引条目时，按已有事实补齐；无法从自维护文档、源码、类型、测试或示例确认的信息必须标记 `MISSING`。
- 根据组件库自维护文档生成或更新 `docs/out-components/` 是实时对外输出，属于 L0/L1，不属于 L2，不得先输出报告等待确认，也不得以评审门槛为由跳过；源码扫描只负责校验和缺口补齐。
- 根据已有外部组件库文档、依赖、源码 import、主题配置、封装适配层或旧文档生成 `docs/components/` 是消费方知识整理，属于 L0/L1，不属于 L2，不得先输出报告等待确认。
- 源码、类型、测试、示例或已有文档无法确认的信息，必须在对应组件文档中标记 `MISSING` 并说明缺口。
- 只有用户要求修改组件库代码、重新设计公共契约或改变组件库分类时，才进入代码实现或设计评审；评审不得阻塞本 skill 对已存在源码事实的文档输出。
- 仅补充既有组件的已确认示例、字段说明或变更记录时，属于 L0，可直接更新，并在交付中说明分级判定依据。
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

以下内容是示例模板，仅供参考，不得作为真实业务事实自动应用。

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
