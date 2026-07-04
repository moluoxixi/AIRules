# memory-candidates · 记忆候选区（待人工审核，永不自动生效）

`distill-candidates` 从 `knowledge/sessions/` 与 `openspec/changes/` 提炼出的 **declarative（是什么、为什么）** 事实落在这里，每条候选一个文件 `<slug>.md`。

## 生命周期

```
distill-candidates 写入 (review_status: pending)
  → 人工审核：改 review_status 为 approved / rejected
  → approved 的记忆候选：交 remember 转正写入 knowledge/memory/ 并登记 MEMORY.md
  → 转正后删除此处候选文件
```

`remember` 只转正 `approved`，拒绝 `pending` / `rejected`——这是写入端死链的客观闸门。

## frontmatter

候选 frontmatter 与正式记忆同构，**额外**带顶层 `review_status`：

```markdown
---
name: <kebab-case-slug>
description: <一句话摘要>
metadata:
  type: decision | gotcha | constraint | boundary | reference
  created_at: <YYYY-MM-DD>
  status: active | superseded
review_status: pending | approved | rejected
---
```

## 两个 status 的正交关系（勿混淆）

| 字段 | 语义 | 取值 |
|---|---|---|
| `review_status`（顶层） | 审核了没 | `pending` / `approved` / `rejected` |
| `metadata.status` | 记忆生命周期（事实是否仍有效） | `active` / `superseded` |

转正写入正式库后 **去掉 `review_status`**——该字段只存在于候选区，正式记忆只保留 `metadata.status`。

## 红线

- 候选**永不自动生效、永不被 recall-memory 召回**（recall 只读 `knowledge/memory/`）。
- 脱敏：不写密钥、token、密码、PII；敏感值按 key 名引用。
- 校验：`npm run candidates:review validate`。列表：`npm run candidates:review list`。
