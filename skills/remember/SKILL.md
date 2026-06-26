---
name: remember
description: 当用户说"记住这条/沉淀这个知识/把这个约定存下来/remember"，或转正已审核通过的记忆候选时触发，写入项目记忆库 `.airules/memory/`。
---

# Remember（写入项目记忆）

把一条值得长期保留的**事实性知识**写入 `.airules/memory/`：一条知识一个文件，外加 `MEMORY.md` 一行索引。这是进化闭环里"记忆"的正式落点——区别于 `distill-candidates` 产出的"待审记忆候选"。

两个入口写入正式记忆库：

1. **显式即写**：用户当场口述"记住这条"——口述即审核，直接写入，不绕候选。
2. **转正候选**：`distill-candidates` 提炼的记忆候选经用户审核通过后，由本 skill 把它从 `.airules/memory-candidates/` 转正写入 `.airules/memory/`。

## 触发条件

- 用户显式说"记住这条 / 沉淀这个知识 / 把这个约定存下来 / remember"时按名调用（显式即写）。
- 用户审核通过某条记忆候选、要求转正落库时按名调用（转正候选）。

## 不适合场景

- **自动从会话提炼记忆** → 走 `distill-candidates` 产出记忆候选待审，不直接由本 skill 落正式库（自动提炼必须经人工审核）。
- **可复用的程序性模式**（"什么时候该怎么做"的流程/方法）→ 由 `distill-candidates` 提炼成 skill 候选，不写记忆库。
- 仓库已经记录的事实（代码结构、git 历史、既有文档、`CLAUDE.md` / `AGENTS.md` 已写明的约定）→ 不重复沉淀。若用户坚持要记，先问"这条里什么是非显然的"，只记那部分。
- 只对当前会话有意义、任务交付后即失效的临时信息 → 不记。
- 一次性偶发、无复用价值的现象 → 不记。

## 记忆库结构

```
.airules/memory/
  MEMORY.md            # 索引：每条记忆一行，每次会话起始由 recall-memory 读取
  <slug>.md            # 单条记忆，带 frontmatter
```

单条记忆文件 `.airules/memory/<slug>.md`：

```markdown
---
name: <kebab-case-slug>
description: <一句话摘要——recall-memory 据此判定与当前任务是否相关>
metadata:
  type: decision | gotcha | constraint | reference
---

<事实正文。用 [[other-slug]] 链接关联记忆。>
```

类型语义：

- `decision`：确定下来的方向/取舍，正文须含**理由**（为什么这样选，否决了什么）。
- `gotcha`：踩坑/教训，正文须追加 `**根因:**` 与 `**规避:**` 两行。
- `constraint`：项目长期约束（架构边界、接口协议、权限模型等）。
- `reference`：外部资源指针（URL、工单号、看板链接）。

`MEMORY.md` 索引行格式（一条一行，正文只放索引，不放记忆内容）：

```markdown
- [<标题>](<slug>.md) — <一句话钩子>
```

## 流程

1. 先查重：读 `.airules/memory/MEMORY.md`（不存在则本次需新建）。若已有文件覆盖同一事实 → 更新那个文件，不建重复；若新知识推翻了旧记忆 → 删除旧文件并移除其索引行。
2. 选定 `type` 与 `kebab-case` slug（动词或主题在前，与文件名一致），写 `.airules/memory/<slug>.md`。
3. 在 `MEMORY.md` 追加（或更新）对应索引行。
4. 若本次是**转正候选**：写入正式库后，删除 `.airules/memory-candidates/` 下对应的候选文件，避免候选区与正式库重复。

## 写入边界与约束

- **脱敏**：不写密钥、token、密码、个人身份信息；涉及敏感值只按 key 名引用（如"使用 `DB_PASSWORD` 环境变量"）。
- 只写 `.airules/memory/`；不得写 `vendor/`、`node_modules/`、`.git/` 或用户未授权位置。
- 涉及写入前若 `.airules/memory/` 不存在，按需创建该目录；不改 `spec-init` 等初始化脚本。
- 用事实陈述，不附加安慰或冗余解释；候选/未确认内容显式标注，不得当作既定事实。
- 记忆是写入时刻的事实快照——不替代代码与文档的事实源，仅作背景知识由 `recall-memory` 读回。
