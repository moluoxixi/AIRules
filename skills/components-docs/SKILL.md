---
name: components-docs
description: 用于生成或更新 docs/components 下的前端组件文档，尤其是组件库、公共组件、Props/Events/Slots、交互状态、可访问性或示例用法需要落文档时触发。
---

# Components Docs

## 输出位置

- 文档路径：`docs/components/<组件名>.md`
- 索引路径：`docs/components/index.md`
- 地图路径：`docs/map.md`

## 组件发现

未指定组件名时，不得直接询问用户要写哪个组件；必须先扫描组件库项目：

```bash
node <components-docs-skill>/scripts/discover-components.mjs <your-project>
```

- 组件库项目中发现的所有组件都必须输出到 `docs/components/`，包括 `src/components/`、`components/` 和组件库入口导出的组件；不得只写公共导出组件，也不得让用户手动挑选组件。
- monorepo 或 workspace 项目只处理组件库子项目；普通前端应用中的业务组件不写入 `docs/components/`。
- 发现到组件时，逐个生成或更新 `docs/components/<组件名>.md`，并同步 `docs/components/index.md` 与 `docs/map.md`。
- 未发现组件时，报告 `MISSING components discovery`，说明已扫描的项目根、组件目录和入口文件；不得在扫描前反问组件名。
- 用户明确指定组件名时，仍需先校验该组件是否存在于组件库发现结果中；找不到时报告 `MISSING component source`。

## 写作规则

- 先读取 `docs/map.md`、`docs/components/index.md`、相关 PRD、架构文档、组件源码和已有组件文档。
- 只描述组件对外契约，不暴露内部实现细节；内部实现变化不应影响文档契约。
- 必须覆盖 Props、事件/回调、插槽/children、状态、可访问性、示例和测试建议。
- 新增或拆分公共组件、组件库分类、Props/Events/Slots/Children 契约、可访问性要求或跨业务复用边界时，属于 L2，必须先输出《组件契约与拆分报告》并等待开发者确认。
- 仅补充既有组件的已确认示例、字段说明或变更记录时，可按 L0 直接更新。
- 更新或新增文档后，同步更新 `docs/components/index.md` 和 `docs/map.md`；`docs/map.md` 必须维护业务域到 PRD/API/组件/测试/组件文档的导航关系。

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
