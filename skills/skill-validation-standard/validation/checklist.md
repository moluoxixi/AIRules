# Skill 校验清单

本文件只提供校验脚本用法和检查清单，不定义新规则；规则以 `SKILL.md` 为准。

## 脚本用法

```bash
node skills/skill-validation-standard/scripts/verify-rules.mjs
node skills/skill-validation-standard/scripts/verify-rules.mjs --root skills/workflow/frontend-code-standard
```

## 结构检查

1. `SKILL.md` 是否存在且大小写正确？
2. 是否以 YAML frontmatter 开头并正确闭合？
3. `name` 是否非空、符合小写连字符命名，并与目录名一致？
4. `description` 是否非空，并说明何时使用？
5. frontmatter 后是否有 Markdown 指令主体？
6. `SKILL.md` 中的相对链接是否真实存在？
7. 是否没有 README、安装指南、快速参考、变更日志等杂项文档？

## 内容检查

1. `description` 是否只写触发条件，而不是复述完整流程？
2. 主体是否精简，只保留触发后必须知道的步骤、约束和资源索引？
3. `scripts/` 是否用于确定性或重复性任务？
4. `references/` 是否用于长篇参考，而不是第二份主规范？
5. `assets/` 是否用于输出素材或模板？
6. 脚本失败时是否显式输出失败并非零退出？
