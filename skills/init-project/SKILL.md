---
name: init-project
description: 用于创建新项目、初始化项目、为已有项目首次接入 AIRules，或需要初始化 CodeGraph、生成项目根 AGENTS.md/CLAUDE.md 时触发。
---

# Init Project

最小化项目初始化：注入项目规则、建立 `CLAUDE.md` 软链、初始化 CodeGraph、建立 `.airules/` spec 工作流骨架；若项目已存在 `.qoder/`，同步 Qoder 项目 rules 兜底。

## 触发条件

- 用户创建新项目、初始化项目，或首次为已有项目接入 AIRules。
- 需要生成/补充项目根 `AGENTS.md`、建立 `CLAUDE.md` 链接或初始化 CodeGraph。

## 不适合场景

- 项目已完成初始化，用户只要求普通业务代码、文档或单个 skill 修改。
- 目标目录或写入权限无法确认时，不猜测、不覆盖用户文件。

## 输出边界

- 只改初始化交付物：项目根 `AGENTS.md`、`CLAUDE.md` 链接、CodeGraph 初始化结果、`.airules/` 工作目录；项目已存在 `.qoder/` 时可覆盖写入 `.qoder/rules/AGENTS.md`。
- 不改依赖目录、构建产物、vendor、宿主目录或用户未授权文件。
- `references/**` 只承载注入到用户项目的项目级规则；不写入 AIRules 维护者规则（变更分级、子代理调度、host 投影、发布流程等归 AIRules 仓库自身）。

## 初始化流程

```mermaid
flowchart TD
  A[确认目标项目根目录] --> B[inject-rules.mjs 注入项目规则]
  B --> C{重复 Markdown 标题?}
  C -->|是| D[停止写入并人工审查合并]
  C -->|否| E[link-claude.mjs 建 CLAUDE.md 软链]
  E --> F[codegraph init -i]
  F --> G[spec-init.mjs 建 .airules spec 工作流骨架]
  G --> W[wiki-init.mjs 建 .qoder/repowiki/wiki_plan.yaml]
  W --> Q{项目存在 .qoder?}
  Q -->|是| R[覆盖注入 .qoder/rules/AGENTS.md]
  Q -->|否| H[交付检查]
  R --> H
```

| 环节 | 命令 | 关键输出 | 失败语义 |
|---|---|---|---|
| 规则注入 | `node "<init-project-skill>/scripts/inject-rules.mjs" <project>` | 项目根 `AGENTS.md`（airules-base + code-core），包在 `AIRULES:BEGIN/END init-project-rules` 托管注释块内 | 已有托管块时覆盖替换；托管块不完整或非托管重复标题时停止并要求人工审查合并 |
| Claude 链接 | `node "<init-project-skill>/scripts/link-claude.mjs" <project>` | `CLAUDE.md` 软链指向 `AGENTS.md` | 非托管文件或链接到其它目标时停止 |
| CodeGraph | 在项目根执行 `codegraph init -i` | `.codegraph` 初始化状态 | 命令缺失报 `MISSING` |
| spec 工作流骨架 | `node "<init-project-skill>/scripts/spec-init.mjs" <project>` | `.airules/{specs,changes,changes/archive}` + `.airules/knowledge/index.md` 空骨架 | 幂等，已存在则跳过；无外部依赖 |
| Qoder wiki / rules 配置 | `node "<init-project-skill>/scripts/wiki-init.mjs" <project>` | `.qoder/repowiki/wiki_plan.yaml`（引导 wiki 读取 `.airules/knowledge/`）；若项目已有 `.qoder/`，从用户根目录 `.qoder/AGENTS.md` 覆盖写入项目 `.qoder/rules/AGENTS.md` | wiki 配置幂等，已存在则跳过；Qoder rules 采用覆盖替换；用户根规则缺失时明确告警并跳过 |

- `<init-project-skill>` 表示已安装的全局 init-project skill 根目录（例如宿主 skills 目录下的 `init-project/`），不是目标项目内路径；执行前必须替换为真实绝对路径，且路径建议加双引号。
- 不要在目标项目内寻找 `skills/init-project/scripts/*.mjs`，这些脚本随全局 skill 分发；若无法定位全局 skill 根目录，标 `MISSING` 并提示用户提供。
- `inject-rules.mjs` 自动处理 `airules-base.md`（仅在 `AGENTS.md` 为空/新建时注入）与 `code-core.md`；命令无需手动传 reference。

## 交付检查

| 检查项 | 期望 |
|---|---|
| 规则 | 项目根 `AGENTS.md` 含项目规范骨架与代码核心纪律 |
| `CLAUDE.md` | 软链接指向 `AGENTS.md`；Windows 无符号链接权限时回退为同一文件实体硬链接，并在日志说明 |
| CodeGraph | `codegraph init -i` 真实执行并报告 `PASS`、`FAIL`、`MISSING` 或 `NOT RUN` |
| spec 工作流 | `.airules/{specs,changes,changes/archive}` 已建；`.airules/knowledge/index.md` 空骨架已建；后续变更立项见 `spec-workflow` skill；文档放入 `.airules/knowledge/`，整理见 `organize-knowledge` skill |
| Qoder wiki / rules | `.qoder/repowiki/wiki_plan.yaml` 已建，内含知识库路径引导；已存在则跳过（`NOT RUN` 可接受）。若项目已有 `.qoder/`，项目 `.qoder/rules/AGENTS.md` 已由用户根目录 `.qoder/AGENTS.md` 覆盖替换 |
