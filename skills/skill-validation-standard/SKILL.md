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

## 辅助资源

- [examples/skill-structure.md](examples/skill-structure.md)：结构示例与反模式
- [examples/validation-output.md](examples/validation-output.md)：校验输出示例
