# skills-candidates · skill 候选区（待人工审核，永不自动生效）

`distill-candidates` 从 `knowledge/sessions/` 与 `openspec/changes/` 提炼出的 **procedural（怎么做）** 模式落在这里，每个候选一个子目录 `<name>/SKILL.md`。

## 生命周期

```
distill-candidates 写入 (review_status: pending)
  → 人工审核：改 review_status 为 approved / rejected
  → approved 的 skill 候选：用户显式迁入项目 skills 目录
  → 转正后删除此处候选目录
```

## review_status（顶层 frontmatter 字段）

| 值 | 含义 | 谁写 |
|---|---|---|
| `pending` | 已提炼、待人工审核 | `distill-candidates` |
| `approved` | 审核采纳，可转正 | 人工 |
| `rejected` | 审核弃用，留痕不转正 | 人工 |

`review_status` 是写入端唯一持久化的审核信号——重跑 distill 据此区分"已审"与"新提"，不靠人脑记忆。

## 红线

- 候选**永不自动生效、永不被主代理自动加载**。
- 本目录内容是草稿，正文须标 `PENDING_REVIEW`。
- 校验：`npm run candidates:review validate`（frontmatter 可解析 + `review_status` 合法枚举，违规 exit 1）。
- 列表：`npm run candidates:review list`（按 `review_status` 分组）。
