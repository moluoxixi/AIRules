---
name: remember
description: 在用户要求记住事实/约定，或转正已审核通过的记忆候选时触发。用于写入项目记忆库 `knowledge/memory/`。
---

# Remember（写入项目记忆）

把一条值得长期保留的**事实性知识**写入 `knowledge/memory/`：一条知识一个文件，外加 `MEMORY.md` 一行索引。这是进化闭环里"记忆"的正式落点——区别于 `distill-candidates` 产出的"待审记忆候选"。

两个入口写入正式记忆库：

1. **显式即写**：用户当场口述"记住这条"——口述即审核，直接写入，不绕候选。
2. **转正候选**：`distill-candidates` 提炼的记忆候选经用户审核通过后，由本 skill 把它从 `knowledge/memory-candidates/` 转正写入 `knowledge/memory/`。**转正前置门**：候选文件开头元信息里的 `review_status` 必须为 `approved`；`pending`（未审）或 `rejected`（已弃）一律拒绝转正，不得越过人工审核。`review_status` 记录"审核了没"，`metadata.status` 记录"事实还是否有效"，两者不要混。

## 触发条件

- 用户显式说"记住这条 / 沉淀这个知识 / 把这个约定存下来 / remember"时按名调用（显式即写）。
- 用户审核通过某条记忆候选、要求转正落库时按名调用（转正候选）。

## 不适合场景

- **自动从会话提炼记忆** → 走 `distill-candidates` 产出记忆候选待审，不直接由本 skill 落正式库（自动提炼必须经人工审核）。
- **可复用做法**（"什么时候该怎么做"的流程/方法）→ 由 `distill-candidates` 提炼成 skill 候选，不写记忆库。
- 仓库已经记录的事实（代码结构、git 历史、既有文档、`CLAUDE.md` / `AGENTS.md` 已写明的约定）→ 不重复沉淀。若用户坚持要记，先问"这条里什么是非显然的"，只记那部分。
- 只对当前会话有意义、任务交付后即失效的临时信息 → 不记。
- 一次性偶发、无复用价值的现象 → 不记。

## 记忆库结构

```
knowledge/memory/
  MEMORY.md            # 索引：每条记忆一行，每次会话起始由 recall-memory 读取
  <slug>.md            # 单条记忆，带文件开头元信息
```

单条记忆文件 `knowledge/memory/<slug>.md`：

```markdown
---
name: <kebab-case-slug>
description: <一句话摘要——recall-memory 据此判定与当前任务是否相关>
metadata:
  type: decision | gotcha | constraint | boundary | reference
  created_at: <YYYY-MM-DD，写入当日>
  status: active | superseded
---

<事实正文。用 [[other-slug]] 链接关联记忆。>
```

类型含义：

- `decision`：确定下来的方向/取舍，正文须含**理由**（为什么这样选，否决了什么）。
- `gotcha`：踩坑/教训，正文须追加 `**根因:**` 与 `**规避:**` 两行。
- `constraint`：项目长期约束（架构边界、接口协议、权限模型等）。正文不仅写"必须怎样"，也要写"何时不做/何时拒绝"。
- `boundary`：安全或权限边界，说明何时不做、何时拒绝、何时必须先确认。它用来防止"以前这么做过"的经验导致越权。正文须写明触发条件与拒绝/谨慎动作。
- `reference`：外部资源指针（URL、工单号、看板链接）。

生命周期字段：

- `created_at`：写入当日日期，供 recall 判断时效与排序。
- `status`：默认 `active`。当新记忆推翻旧记忆时，旧记忆不直接删，改标 `status: superseded` 留可追溯轨迹；`recall-memory` 默认只召回 `active`。过时记忆越像真的越危险，所以状态过滤是默认门。

`MEMORY.md` 索引行格式（一条一行，正文只放索引，不放记忆内容）：

```markdown
- [<标题>](<slug>.md) — <一句话钩子>
```

## 流程

1. 先查重：读 `knowledge/memory/MEMORY.md`（不存在则本次需新建）。若已有文件覆盖同一事实 → 更新那个文件，不建重复；若新知识推翻了旧记忆 → 把旧文件标 `status: superseded`（保留可追溯轨迹，不直接删），并在 `MEMORY.md` 索引行标注其已被取代；仅当旧记忆确属错误且无追溯价值时才删除。
2. 选定 `type` 与短横线命名的 slug（动词或主题在前，与文件名一致），填 `created_at`（当日）与 `status: active`，写 `knowledge/memory/<slug>.md`。正式记忆**不带 `review_status`**：这个字段只存在于候选区，转正后就不再需要。
3. 在 `MEMORY.md` 追加（或更新）对应索引行。
4. 若本次是**转正候选**：先确认候选 `review_status` 为 `approved`（非 `approved` 拒绝转正）；写入正式库后，删除 `knowledge/memory-candidates/` 下对应的候选文件，避免候选区与正式库重复。

## 写入边界与约束

- **写入范围**：本 skill 只写**当前项目的记忆**（`knowledge/memory/`）：项目事实、约束、仓库决策、局部踩坑。用户偏好、跨项目习惯属于宿主提供的全局记忆，不写进项目仓库；"遇到什么场景该怎么做"的做法属于 skill 候选，走 `distill-candidates`，不写记忆库。
- **脱敏**：不写密钥、token、密码、个人身份信息；涉及敏感值只按 key 名引用（如"使用 `DB_PASSWORD` 环境变量"）。
- 只写 `knowledge/memory/`；不得写 `vendor/`、`node_modules/`、`.git/` 或用户未授权位置。
- 涉及写入前若 `knowledge/memory/` 不存在，按需创建该目录；不改 `spec-init` 等初始化脚本。
- 用事实陈述，不附加安慰或冗余解释；候选/未确认内容显式标注，不得当作既定事实。
- 记忆是写入时刻的事实快照——不替代代码与文档的事实源，仅作背景知识由 `recall-memory` 读回。
