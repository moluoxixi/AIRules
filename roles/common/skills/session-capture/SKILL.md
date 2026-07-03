---
name: session-capture
---

# Session Capture（会话沉淀）

把当前会话里值得长期保留的关键信息沉淀到 `.airules/sessions/`，作为后续提炼 skill/规则的原始素材。永久积累，区别于一次性接力的 handoff。

## 触发条件

- 用户显式说"沉淀会话/记录这次关键信息/把这次的约定存下来/capture session"时按名调用。

## 不适合场景

- 主代理普通对话不主动加载本 skill（故省略 description），不自动触发。
- 跨会话接力交接 → 走 `handoff`（临时、用完即弃）。
- 任务已交付且无可复用沉淀价值 → 不强行记录。
- 单条明确的事实/约定，无需整篇会话沉淀 → 直接交 `remember` 落记忆库。

## 输出

在 `.airules/sessions/<date>-<topic>.md` 写一份结构化沉淀（一个主题一个文件，不覆盖历史）。每条沉淀打**分流标签**，让下游路由无歧义：

- `[declarative]` 事实/教训/决策/约束 → 后续交 `remember` 落 `.airules/memory/`。
- `[procedural]` 可复用的"什么时候该怎么做"的程序性模式 → 后续交 `distill-candidates` 提炼成 skill 候选。

```markdown
# Session — <主题>（<date>）

## 关键决策
<本次确定下来的方向/取舍及其理由，一条一行；默认 [declarative]>

## 踩坑与教训
<遇到的问题、根因、规避方式；默认 [declarative]，含根因 + 规避>

## 可复用约定 / 模式
<- [procedural] 可提炼为 skill 的做法（什么时候该怎么做）
 - [declarative] 项目专属约定/事实（是什么、为什么）>

## 关联产物
<相关 change-id、文件路径、PR 链接>
```

分流原则：**怎么做**（流程、方法、可照搬的步骤）= `procedural`；**是什么 / 为什么**（事实、决策理由、约束、踩坑根因）= `declarative`。拿不准时默认 `declarative`（事实更安全，不会被误提炼成 skill）。

## 写入边界与约束

- **脱敏**：不写密钥、token、密码、个人身份信息；涉及敏感值时只按 key 名引用（如"使用 DB_PASSWORD 环境变量"）。
- **scope 项目局部**：只写当前项目 `.airules/sessions/`，作为该项目的原始素材；不得写 `vendor/`、`node_modules/`、`.git/` 或用户未授权位置。沉淀里若含全局可复用洞见，仅打标待 `distill-candidates` 事后判 scope，不在本 skill 决定全局/项目落点。
- 与 `handoff` 区分：沉淀是永久积累供提炼，handoff 是临时接力文档。
- 沉淀是**原始素材**：`[procedural]` 与 `[declarative]` 条目都由 `distill-candidates` 事后扫描提炼成候选（skill 候选 / 记忆候选，两类待审），本 skill 只负责打标分流，不直接写记忆库、skill 候选或正式记忆。
- 用事实陈述，不附加安慰或冗余解释；候选/未确认内容显式标注，不得当作既定事实。
