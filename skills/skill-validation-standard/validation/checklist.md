# 校验脚本用法

规则定义见 [../SKILL.md](../SKILL.md)，本文件只提供脚本用法。

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
