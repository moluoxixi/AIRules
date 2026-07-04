# ADR-0007 统一知识目录契约

## 状态

accepted

## 背景

当前项目文档分散在 `docs/` 下，无统一的编排入口。`docs/` 采用英文子目录命名，与项目中文主线风格不一致，且没有标准机制感知文档变更后触发整理与读取。

[ADR-0004](./ADR-0004-knowledge-retrieval-protocol.md) 确立了"普通文件检索 / grep → CodeGraph → 项目 memory → 全局 memory → 宿主 MCP"的读取顺序，但未规定项目文档的物理目录入口，导致编排在"先读文档"时缺少稳定的单点入口。

## 决策

**废弃 `docs/` 与旧隐藏知识目录路径，将项目知识统一放到根目录 `knowledge/`**。OpenSpec 自己维护 `openspec/`；会话沉淀、记忆、候选区也归入 `knowledge/`，避免一部分套隐藏目录、一部分不套。

### 目录契约

```
knowledge/
  index.md           # 编排唯一入口：列出所有子目录及文档路径
  架构/              # 子目录按中文内容语义命名，按需创建
  接口协议/
  产品需求/
  测试/
  开发计划/
  复盘/
  其他/
  memory/            # 项目记忆
  memory-candidates/ # 待审核记忆候选
  skills-candidates/ # 待审核 skill 候选
  sessions/          # 会话沉淀与自动会话索引
```

- **`index.md` 是编排的唯一知识入口**：每行对应一个文件，不在编排中散点检索子目录。
- **子目录中文命名**：语义优先，按需创建，不预设固定分类层级。
- **沉淀类目录也放在 `knowledge/` 下**：memory、candidates、sessions 都是知识治理资产，不再落旧隐藏目录。
- **不提供同步 skill**：文档如何进入 `knowledge/` 由用户自行决定，系统不自动拉取或同步。

### 编排 diff 触发机制

任务初始化时，编排在 `recall-memory` 之后、需求分析之前执行 knowledge diff 检查：

1. `git diff HEAD -- knowledge/` 或对比上次整理快照（快照写 `knowledge/.last-organized`）
2. **有变更**：先显式触发 `organize-knowledge` 整理，再从 `index.md` 读取
3. **无变更**：直接从 `index.md` 读取

### 与 ADR-0004 的关系

ADR-0004 读取顺序第 1 层原表述为"普通文件检索 / grep → 项目内代码、`docs/**`、`README`、`AGENTS.md`"。本 ADR 将该层的项目文档入口从 `docs/**` 替换为 `knowledge/index.md`（经 diff 触发整理后读取），`README` 与 `AGENTS.md` 直接检索语义不变。

## 替代方案

- **保留 `docs/` 不迁移**：无统一入口，编排仍需散点检索；中英混用目录不一致问题继续存在。
- **引入注册表文件**：增加安装/维护成本，与轻量化方向相悖（参见 ADR-0004 替代方案）。

## 影响

- `docs/` 与旧隐藏知识目录废弃并迁移至 `knowledge/`；内部所有交叉引用路径同步更新。
- `rules/AGENTS.md`：编排初始化逻辑在 recall-memory 之后增加 knowledge diff 检查（详见编排 diff 触发机制）。
- `skills/brainstorming/SKILL.md`：读取事实依据时先读 `knowledge/index.md`，命中相关知识作为事实背景。
- `skills/writing-plans/SKILL.md`："契约来源"字段可引用 `knowledge/` 下的文件。
- `skills/init-project/SKILL.md` 及 `references/airules-base.md`：不再创建 `docs/` 或旧隐藏目录 骨架，改为创建 `knowledge/index.md` 空骨架。
- `organize-knowledge` skill：无 `description`（不自动加载），由编排 diff 触发或用户手动调用，负责整理文档并维护 `index.md`。
- ADR-0004 的第 1 层读取链路需同步更新，标注项目文档入口变更。
