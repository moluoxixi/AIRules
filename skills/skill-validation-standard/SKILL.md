---
name: skill-validation-standard
description: 用于创建、修改或评审任意 Claude/Codex skill 后，校验 SKILL.md、触发描述、资源组织、链接、脚本语义和内容质量是否符合 Skills 规范。
---

# Skill 校验规范

## 用途

本 Skill 用于校验新建或修改后的 AI skill 产物，确保其元数据、触发描述、资源组织、链接、脚本语义和内容质量符合 AI Skills 规范基线。

## 核心检查

1. `SKILL.md` 必须存在，并以 YAML frontmatter 开头。
2. frontmatter 必须包含非空 `name` 和 `description`；`name` 使用小写字母、数字和连字符，并与目录名一致。
3. `description` 是触发入口，必须说明何时使用该 skill，包含具体任务、场景或症状；不得只总结流程。
4. frontmatter 后必须有 Markdown 指令主体，主体只写触发后必须立即知道的流程、约束和资源索引。
5. `scripts/`、`references/`、`assets/` 是合法可选资源；只在能降低重复、承载长文档或提供输出素材时创建。
6. `SKILL.md` 引用的相对链接必须真实存在；长资源应从 `SKILL.md` 直接索引，避免深层跳转。
7. 不得添加 README、安装指南、快速参考、变更日志等和 skill 执行无关的杂项文档。
8. 存在可执行脚本时，必须具备可见成功/失败语义；失败不能静默吞掉。

## 内容质量

- 只写 AI 执行任务所需的信息，删除创建过程、历史叙述和泛泛解释。
- 规则、流程和资源职责不得互相重复；同一信息只能有一个权威位置。
- 示例要短、具体、可迁移；不要用多语言示例堆数量。
- 对复杂或高风险 skill，应补充可运行脚本、测试场景或检查清单。

## 资源

- 结构示例：[skill-structure.md](examples/skill-structure.md)
- 校验清单：[checklist.md](validation/checklist.md)
- 通用校验脚本：`scripts/verify-rules.mjs`

## 校验命令

```bash
node skills/skill-validation-standard/scripts/verify-rules.mjs --root path/to/skill
```

未传 `--root` 时默认校验本 Skill。
