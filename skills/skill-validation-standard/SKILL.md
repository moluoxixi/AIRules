---
name: skill-validation-standard
description: 校验 Claude/Codex skill 的 YAML frontmatter。用于创建、修改或评审 skill 后确认 SKILL.md 元数据格式正确。
---

# Skill 校验流程

## 校验范围

本 Skill 只检查 `SKILL.md` 文件本身的 YAML frontmatter 是否完整可读。Markdown 内容、外部文件、目录和辅助脚本不在本规范范围内。

## 执行步骤

1. 读取目标 skill 根目录下的 `SKILL.md`。
2. 检查文件是否以 YAML frontmatter 开始，并使用 `---` 正确闭合。
3. 检查 frontmatter 至少包含非空 `name` 与 `description`。
4. 汇总 `PASS` / `FAIL` 结果，`FAIL` 项必须修复。

## 判定标准

### YAML frontmatter

| # | 检查项 | FAIL 条件 |
|---|--------|-----------|
| Y1 | `SKILL.md` 以 YAML frontmatter 开头 | 文件不是以 `---` 开头 |
| Y2 | frontmatter 正确闭合 | 找不到第二个 `---` 分隔符 |
| Y3 | frontmatter 行是 `key: value` 结构 | 非空行缺少 key、冒号或 value |
| Y4 | `name` 与 `description` 均存在 | 任一字段缺失或为空 |

## 命令

```bash
node skills/skill-validation-standard/scripts/verify-rules.mjs --root path/to/skill
```
