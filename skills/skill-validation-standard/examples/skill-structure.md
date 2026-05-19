# Skill 结构示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 最小结构

```text
my-skill/
  SKILL.md
```

```markdown
---
name: my-skill
description: Use when editing generated invoices, receipts, or billing documents that must preserve layout and totals.
---

# My Skill

## Workflow

1. Inspect the input.
2. Apply the task-specific steps.
3. Report verification and remaining risk.
```

## 带资源结构

```text
my-skill/
  SKILL.md
  scripts/
    normalize-input.mjs
  references/
    api-schema.md
  assets/
    template.docx
```

`scripts/`、`references/` 和 `assets/` 都是合法可选资源。是否创建它们取决于 skill 是否需要确定性代码、长篇参考或输出素材。

## 不推荐结构

```text
my-skill/
  SKILL.md
  README.md
  QUICK_REFERENCE.md
  CHANGELOG.md
```

这些文件会制造重复入口。需要被 AI 读取的内容应放进 `SKILL.md` 或直接索引的资源文件。
