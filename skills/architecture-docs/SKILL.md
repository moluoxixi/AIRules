---
name: architecture-docs
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
- 变更分级（L0/L1/L2）与澄清门禁的统一定义见项目 `AGENTS.md` 的「变更分级与确认门禁」「澄清门禁」两节；本 skill 的 L2 判定以该定义为准。
- 命中澄清门禁时（属于 L2，或模块边界、分层、依赖方向、数据模型、接口协议、权限模型、部署拓扑、技术选型或 ADR 影响缺少明确来源或存在歧义），必须先输出《架构澄清问题清单》或《架构文档设计报告》，用苏格拉底式问题逐项暴露目标约束、替代方案、边界归属、依赖风险、安全边界、运行时假设和决策后果；未确认内容必须标记为 `MISSING`，澄清未闭环前不得定稿。
- 不得把架构规范直接写成长篇 `AGENTS.md`；`AGENTS.md` 只保留必须执行的简短规则或文档入口。
- 新增或修改模块边界、分层、依赖方向、数据模型、接口协议、权限模型、部署拓扑或技术选型时，属于 L2，必须先完成澄清门禁并输出《架构文档设计报告》，等待开发者确认后才能定稿。
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

proposed | accepted | deprecated | superseded by ADR-XXXX

## 背景

（让未在场者能理解为何需要此决策；技术事实经 knowledge-search 命中后标源 ID，无源标 MISSING）

## 决策

（用主动语态写「我们将……」，明确包含与不包含的范围）

## 替代方案

（至少 2-3 个，每个公平描述其特征与适用条件，禁止稻草人；每个标注被否原因）

## 评估标准

（显式列评估维度：性能/可测试性/团队熟悉度/成本/耦合度/安全边界，及各方案对比）

## 影响

（必须分三类列全：正面——什么变简单；负面——什么变难、新增约束；中性。只写正面视为不合格）

## 可逆性

（可逆 / 部分可逆 / 不可逆 + 回退代价说明。不可逆或高代价回退的决策强制走 L2 澄清门禁）

## 后续约束

（触发重新评估的条件、需监控的指标、关联待决决策）
```

### ADR 定稿自检（全部通过才可 accepted）

- [ ] 标题为简短名词短语
- [ ] 状态明确（proposed/accepted/deprecated/superseded by ADR-XXXX）
- [ ] 背景让未在场者能理解为何需要此决策
- [ ] 决策为主动语态、范围清晰
- [ ] 影响含正/负/中性三类
- [ ] 替代方案公平、含被否原因
- [ ] 可逆性与回退代价已标注
- [ ] 本 ADR 可独立成文，不依赖外部文档即可读懂
- [ ] 每条技术事实绑定 knowledge 源 ID，无来源项标 `MISSING`
- 「背景/约束/替代方案/评估标准」的技术事实（现有技术栈、部署拓扑、性能基线、团队约束）必须先经 `knowledge-search` 命中 `airules.knowledge.json` 登记来源后引用，ADR 内以源 ID 标注；无源标 `MISSING`，禁止用通用工程常识替代项目事实。`superseded by` 取代旧 ADR 时，须经 knowledge-search 确认旧 ADR 存在并同步更新 `docs/architecture/decisions/index.md`。

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
