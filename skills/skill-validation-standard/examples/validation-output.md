# 校验输出示例

## 脚本输出（结构硬约束）

### 全部通过

```text
PASS SKILL.md exists
PASS frontmatter valid
PASS name: my-skill (12 chars)
PASS description: 89 chars, contains action keywords
PASS body: 45 lines
PASS links: 2 valid
PASS no forbidden docs
PASS no deep references
PASS script semantics valid
────────────────────────────
PASS skill is valid
  name: my-skill
  root: /path/to/my-skill
```

### 存在问题

```text
PASS SKILL.md exists
PASS frontmatter valid
FAIL name "My-Skill" must be lowercase with hyphens
PASS description: 89 chars, contains action keywords
WARN body: 520 lines exceeds 500 line limit, consider splitting
FAIL link not found: examples/missing.md
PASS no forbidden docs
WARN deep reference: reference/api.md → reference/internal.md
PASS script semantics valid
────────────────────────────
FAIL 2 errors, 2 warnings
```

## AI 审查输出（内容质量）

### 格式

```text
## 触发描述

| # | 检查项 | 结果 | 证据 |
|---|--------|------|------|
| Q1 | description 覆盖"做什么"和"何时使用" | PASS | "校验...符合最佳实践"(做什么) + "用于创建、修改或评审 skill 后"(何时使用) |
| Q2 | 关键 use case 在前 | PASS | "校验"在首位 |
| Q3 | 第三人称 | PASS | 无第一/二人称 |
| Q4 | 长度限制 | PASS | description 67 字符 |

## 正文精简度

| # | 检查项 | 结果 | 证据 |
|---|--------|------|------|
| Q5 | 只写必要信息 | PASS | 无创建历史或泛泛解释 |
| Q6 | 不重复通用知识 | PASS | 无 JSON/PDF 等基础解释 |
| Q7 | 信息不重复 | FAIL | rubric 在 SKILL.md 和 checklist.md 各出现一次 |

...

## 汇总

- PASS: 15
- WARN: 2
- FAIL: 1

### 必须修复

1. Q7: 删除 checklist.md 中的重复 rubric，只保留脚本用法说明

### 建议改进

1. Q8: SKILL.md 正文 120 行，考虑将 rubric 表格拆到 validation/rubric.md
2. Q12: examples/skill-structure.md 缺少输入/输出对示例
```
