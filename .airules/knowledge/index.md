# 知识库索引

<!-- 编排唯一入口：每行对应一个文件 -->

## 架构

- [架构概览](架构/overview.md) — AIRules 系统架构目标、模块边界、分层依赖、数据流与部署信息
- [Agent 分层](架构/agent-layer.md) — Agent 层与 Skill 层职责边界及 5 个第一方开发链路 agent 定位
- [宿主 Agent/MCP 格式映射](架构/host-agent-mcp-mapping.md) — 各宿主 agent 文件格式与 MCP 配置映射知识
- [宿主 hook 格式映射](架构/host-hook-mapping.md) — 各宿主会话 hook 格式差异与跨宿主行为红线
- [Hook 现网烟测指引](架构/hook-smoke-test-guide.md) — PreToolUse 熔断 hook 与 SubagentStop 计数 hook 的真宿主验证步骤
- [回路熔断进度账本协议](架构/loop-ledger-protocol.md) — 进度账本字段语义、生命周期与读写责任（loop-ledger 运行时承载）
- [架构文档索引](架构/index.md) — 架构子目录文档列表

### 架构决策记录

- [ADR 索引](架构/decisions/index.md) — 全部 ADR 汇总列表
- [ADR-0001 知识源注册表](架构/decisions/ADR-0001-knowledge-source-registry.md) — 知识源注册表与检索契约（superseded by ADR-0004）
- [ADR-0002 Skill/Agent 分层](架构/decisions/ADR-0002-skill-agent-layering.md) — Skill 与 Agent 两层职责分离（superseded by ADR-0003）
- [ADR-0003 5-agent 收敛](架构/decisions/ADR-0003-five-agent-convergence.md) — 收敛为 5-agent + 按需多实例
- [ADR-0004 知识检索协议](架构/decisions/ADR-0004-knowledge-retrieval-protocol.md) — 知识检索协议，取代注册表
- [ADR-0005 会话 hook 投影](架构/decisions/ADR-0005-session-auto-log-hook.md) — 会话自动记录 Stop hook 多宿主投影
- [ADR-0006 跨宿主 hook 能力基线](架构/decisions/ADR-0006-cross-host-hook-capability-baseline.md) — 跨宿主 hook 能力基线与阻断边界
- [ADR-0007 统一知识目录契约](架构/decisions/ADR-0007-knowledge-directory-contract.md) — 废弃 docs/，统一迁移至 .airules/knowledge/

## 接口协议

- [接口文档索引](接口协议/index.md) — 全局接口协议、业务接口契约、联调状态汇总
- [全局接口协议](接口协议/_protocol.md) — 成功响应、列表分页、错误响应、鉴权、版本策略

## 产品需求

- [需求文档索引](产品需求/index.md) — 业务背景、目标、范围、流程、字段口径、验收标准汇总

## 测试

- [测试文档索引](测试/index.md) — 测试策略、用例矩阵、数据准备、联调验证、回归范围汇总

## 开发计划

- [Knowledge Source Registry 实施计划](开发计划/2026-06-09-knowledge-source-registry.md) — 知识源注册表功能的分步实施计划（已归档）

## 复盘

- [Qoder 共享资源偏差分析](复盘/2026-06-22-qoder-shared-resources.md) — Qoder 单 host 旧方案、SharedClientCache MCP 特例与 IDE 上游缺口的根因分析

## 其他

- [其它文档索引](其他/index.md) — 初始化前已存在但尚未归类的项目文档

## 知识检索

项目知识检索遵循 [ADR-0004 知识检索协议](架构/decisions/ADR-0004-knowledge-retrieval-protocol.md)：普通文件检索 / grep → CodeGraph → 项目 memory（`.airules/memory/`）→ 全局 memory → 宿主 MCP 外部资料。代码与文档为权威事实源，记忆与外部资料仅作背景证据，冲突时以代码/文档为准。

## 维护约定

- 新增业务文档时，使用稳定业务名作为文件名，例如 `采购订单.md`。
- 架构文档放入 `架构/`，接口文档放入 `接口协议/`，需求文档放入 `产品需求/`，测试文档放入 `测试/`。
- 新增或改名文档后，同步更新对应目录的 `index.md` 和本文件。
- 文档只记录已确认事实；缺失信息标记为 `MISSING`，不得用代码推断伪造业务结论。
