---
name: architecture-docs
description: 用于生成或更新 docs/architecture 下的架构文档，尤其是模块边界、分层、依赖方向、数据流、权限模型、部署拓扑、技术选型或 ADR 需要落文档时触发。
---

# Architecture Docs

## 触发条件

- 用户要求生成、更新或标准化架构文档、模块边界、部署拓扑、权限模型或 ADR 时使用。
- 已有代码结构、架构事实或用户确认的技术决策需要沉淀到 `docs/architecture/` 时使用。

## 不适合场景

- 只需要改代码、修测试或解释局部实现，不需要形成架构文档时不要使用。
- 缺少来源证据或用户确认时，不要替项目做架构决策；标记 `MISSING` 或先输出待确认项。

## 输出边界

- 只写 `docs/architecture/`、`docs/architecture/decisions/`、对应索引和 `docs/map.md`。
- 不把长篇架构规范直接写入 `AGENTS.md`，不自动修改代码、部署配置或接口协议。

## 输出位置

- 架构索引：`docs/architecture/index.md`
- 架构概览：`docs/architecture/overview.md`
- 架构决策：`docs/architecture/decisions/<ADR编号>-<决策名>.md`
- 地图路径：`docs/map.md`

## 写作规则

- 先读取 `docs/map.md`、`docs/architecture/index.md`、`docs/architecture/overview.md`、相关 ADR、PRD、API 协议和现有代码结构。
- 架构事实优先来自用户确认、已有架构文档、代码模块边界、部署配置、接口协议和 ADR；无法确认时标记 `MISSING`。
- 不得把架构规范直接写成长篇 `AGENTS.md`；`AGENTS.md` 只保留必须执行的简短规则或文档入口。
- 新增或修改模块边界、分层、依赖方向、数据模型、接口协议、权限模型、部署拓扑或技术选型时，属于 L2，必须先输出《架构文档设计报告》并等待开发者确认。
- 更新或新增文档后，同步更新 `docs/architecture/index.md` 和 `docs/map.md`；新增 ADR 时同步更新 `docs/architecture/decisions/index.md`。

## 文档结构

```md
# <架构主题>

## 背景

## 现状

## 模块边界

## 依赖方向

## 数据流

## 权限与安全边界

## 部署与运行时

## 决策与约束

## 风险与待确认
```

## ADR 结构

```md
# ADR-0001 <决策名>

## 状态

proposed | accepted | deprecated | superseded

## 背景

## 决策

## 替代方案

## 影响

## 后续约束
```

## 示例

以下内容是示例模板，仅供参考，不得作为真实业务事实自动应用。

```md
# 采购订单模块架构

## 模块边界

| 模块 | 职责 | 不负责 |
|---|---|---|
| PurchaseOrder | 采购订单创建、审批状态、订单明细 | 入库单库存记账 |
| WarehouseReceipt | 入库记录、收货数量、库存入账 | 采购审批 |

## 依赖方向

- PurchaseOrder 可读取供应商基础信息。
- WarehouseReceipt 可引用采购订单号，但不得修改采购订单审批状态。

## 风险与待确认

- MISSING：采购订单关闭后是否允许补录入库。
```
