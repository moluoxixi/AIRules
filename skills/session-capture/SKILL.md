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

## 输出

在 `.airules/sessions/<date>-<topic>.md` 写一份结构化沉淀（一个主题一个文件，不覆盖历史）：

```markdown
# Session — <主题>（<date>）

## 关键决策
<本次确定下来的方向/取舍及其理由，一条一行>

## 踩坑与教训
<遇到的问题、根因、规避方式>

## 可复用约定 / 模式
<可能值得提炼为 skill 或项目规则的做法>

## 关联产物
<相关 change-id、文件路径、PR 链接>
```

## 写入边界与约束

- **脱敏**：不写密钥、token、密码、个人身份信息；涉及敏感值时只按 key 名引用（如"使用 DB_PASSWORD 环境变量"）。
- 只写 `.airules/sessions/`；不得写 `vendor/`、`node_modules/`、`.git/` 或用户未授权位置。
- 与 `handoff` 区分：沉淀是永久积累供提炼，handoff 是临时接力文档。
- 用事实陈述，不附加安慰或冗余解释；候选/未确认内容显式标注，不得当作既定事实。
