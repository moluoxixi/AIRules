---
name: skill-validation-standard
description: 校验 Claude/Codex skill 是否符合官方最佳实践。用于创建、修改或评审 skill 后，检查 SKILL.md 元数据、触发描述、正文精简度、资源组织和脚本语义。
---

# Skill 校验流程

## 执行步骤

1. 运行结构校验脚本，确认硬约束全部 PASS：
   ```bash
   node skills/skill-validation-standard/scripts/verify-rules.mjs --root path/to/skill
   ```
2. 按下方 rubric 逐项审查，对每项给出 PASS / FAIL / WARN 并附证据。
3. 汇总结果，FAIL 项必须修复，WARN 项建议改进。

## 内容质量 rubric

### 触发描述

| # | 检查项 | FAIL 条件 |
|---|--------|-----------|
| Q1 | description 同时覆盖"做什么"和"何时使用" | 缺少任一 |
| Q2 | 关键 use case 在 description 最前面 | 次要信息在前（WARN） |
| Q3 | 使用第三人称 | 出现 "I can" / "You can" / "我能" |
| Q4 | description ≤160 字符，when_to_use ≤512 字符 | 超出（WARN） |

### 正文精简度

| # | 检查项 | FAIL 条件 |
|---|--------|-----------|
| Q5 | 只写触发后必须立即知道的流程、约束和资源索引 | 包含创建历史、泛泛解释（WARN） |
| Q6 | 不重复 Claude 已有的通用知识 | 解释 JSON 格式、PDF 是什么等（WARN） |
| Q7 | 同一信息只有一个权威位置 | 规则/流程在多处重复 |

### 资源组织

| # | 检查项 | FAIL 条件 |
|---|--------|-----------|
| Q8 | 长内容（>100 行）拆到独立 reference 文件 | 全堆在 SKILL.md（WARN） |
| Q9 | reference 文件从 SKILL.md 直接索引 | 需要跳两层才能到达 |
| Q10 | 长 reference 文件（>100 行）有目录 | 缺少（WARN） |
| Q11 | 文件名语义化 | 使用 doc1.md / file2.md（WARN） |

### 示例与脚本

| # | 检查项 | FAIL 条件 |
|---|--------|-----------|
| Q12 | 示例具体、可迁移，最好是输入/输出对 | 只有抽象描述（WARN） |
| Q13 | 脚本用于确定性操作，正文区分"执行"还是"阅读" | 含糊不清（WARN） |
| Q14 | 脚本错误处理显式、信息清晰 | 静默吞错 |
| Q15 | 复杂工作流有验证闭环 | 高风险操作无验证（WARN） |

### 整体质量

| # | 检查项 | FAIL 条件 |
|---|--------|-----------|
| Q16 | 术语一致 | 同一概念多个名称（WARN） |
| Q17 | 不含时效性信息 | 硬编码日期判断 |
| Q18 | 给出默认推荐而非罗列等价方案 | 列举 3+ 方案无推荐（WARN） |

## 结构示例与反模式

本节即 Skill 结构示例与反模式。

### 最小结构

```text
my-skill/
  SKILL.md
```

```yaml
---
name: my-skill
description: 从 PDF 提取文本和表格，填充表单，合并文档。用于处理 PDF 文件或用户提及 PDF、表单、文档提取时。
---
```

要点：description 同时写了“做什么”和“何时使用”，关键 use case 在前，第三人称。

### 带资源结构

```text
my-skill/
  SKILL.md
  examples/
    sample-output.md
  scripts/
    validate.py
  validation/
    checklist.md       # 可选，仅当 SKILL.md rubric 不够时
```

所有 reference 文件从 SKILL.md 直接索引（一层深）：

```markdown
## 辅助资源

- examples/sample-output.md：输出示例
- validation/checklist.md：校验清单
```

### 反模式

#### 杂项文档

```text
my-skill/
  SKILL.md
  README.md          ← 禁止：制造重复入口
  QUICK_REFERENCE.md ← 禁止：和 SKILL.md 职责重叠
  CHANGELOG.md       ← 禁止：和 skill 执行无关
```

#### 深层跳转

```text
SKILL.md → advanced.md → details.md → actual-info.md
```

Claude 可能只部分读取深层文件。所有 reference 应从 SKILL.md 直接链接。

#### description 写法

```yaml
# 太模糊
description: Helps with documents

# 第一人称
description: I can help you process Excel files

# 只写流程不写触发
description: 先分析输入，再应用规则，最后输出结果

# 包含保留词
description: Use claude-helper to process files

# 过长（超过 160 字符）
description: 用于创建、修改或评审任意 Claude/Codex skill 后，校验其是否符合官方 Skills 最佳实践，包括 SKILL.md 元数据、触发描述质量、正文精简度、资源拆分、引用深度、脚本语义和内容质量。
```

### 正确写法

```yaml
description: 校验 Claude/Codex skill 是否符合官方最佳实践。用于创建、修改或评审 skill 后。
```

## 校验输出示例

### 脚本输出（结构硬约束）

#### 全部通过

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

#### 存在问题

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

## 校验脚本用法

规则定义见 `SKILL.md`，本文件只提供脚本用法。

## 命令

```bash
# 校验指定 skill
node skills/skill-validation-standard/scripts/verify-rules.mjs --root path/to/skill

# 校验本 skill（默认）
node skills/skill-validation-standard/scripts/verify-rules.mjs
```

## 输出语义

- `PASS`：检查通过
- `FAIL`：必须修复
- `WARN`：建议改进

脚本只覆盖结构硬约束，内容质量由 AI 按 SKILL.md rubric 审查。
