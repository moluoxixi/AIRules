---
name: init-project
description: 用于创建新项目、初始化项目、为已有项目首次接入 AIRules、生成项目根 AGENTS.md/CLAUDE.md 或初始化 CodeGraph 时触发。
---

# Init Project

## 分析项目背景

开始初始化前，先执行确定性技术栈检测脚本，形成最小项目背景：

```bash
node <init-project-skill>/scripts/detect-stack.mjs <your-project>
```

- 项目类型来自脚本输出的 `stacks` 字段，可能包含 `frontend`、`node`、`nestjs`、`java`。
- 规则文件来自脚本输出的 `references` 字段。
- 证据入口来自脚本输出的 `evidence` 字段；交付时保留关键证据，便于用户审计。
- 写入边界：只修改目标项目根目录的 `AGENTS.md` 和 `CLAUDE.md`；不得改动依赖目录、构建产物、vendor 或用户未授权文件。
- 缺失事实：脚本输出空 `stacks` 时，只注入通用 AIRules 基线；不要猜测语言规则。

## 初始化项目文档骨架

根据技术栈检测结果创建项目文档知识库骨架：

```bash
node <init-project-skill>/scripts/scaffold-docs.mjs <your-project> <detect-stack 输出的 stack...>
```

- 所有项目都会创建 `docs/architecture/`、`docs/api/`、`docs/prds/`、`docs/test/` 和 `docs/map.md`。
- `docs/architecture/` 包含 `index.md`、`overview.md` 和 `decisions/index.md`，用于承载架构事实与 ADR。
- `docs/api/` 包含 `index.md` 和 `_protocol.md`，用于承载全局接口协议与业务接口索引。
- 前端项目额外创建 `docs/components/`。
- 脚本只创建缺失目录与索引文件；若用户已有同名文档，必须保留原内容。
- `采购订单.md` 这类业务文档不在初始化时硬编码创建，必须在具体业务任务中由 `prd-docs`、`api-docs`、`components-docs` 或 `test-docs` 独立生成，并同步维护 `docs/map.md`。
- 架构文档与 ADR 必须在具体架构任务中由 `architecture-docs` 独立生成或更新，并同步维护 `docs/architecture/index.md` 与 `docs/map.md`。

## 根据项目背景注入规则

执行脚本时会按目标项目现状注入规则：

- 当 `AGENTS.md` 不存在或为空时，先注入 `references/airules-base.md`，为用户创建 `# 项目规范` 与项目自定义规范占位。
- 当 `AGENTS.md` 已存在且包含用户内容时，跳过 `references/airules-base.md`，避免向用户已有规范中追加占位段。
- 始终注入 `references/project-docs-standard.md`，再按检测结果选择语言规则文件，并注入目标项目根目录 `AGENTS.md`：

| `detect-stack.mjs` 输出 stack | 追加注入 references |
|---|---|
| `frontend` | `frontend-code-standard.md` |
| `node` | `node-code-standard.md` |
| `nestjs` | `nestjs-code-standard.md` |
| `java` | `java-code-standard.md` |

执行内容注入脚本：

```bash
node <init-project-skill>/scripts/inject-rules.mjs <your-project> <init-project-skill>/references/<rule>.md [...]
```

无法判断技术栈时不传额外语言规则，脚本只注入 `airules-base.md`。当目标项目不存在 `AGENTS.md` 时，脚本创建该文件；当文件已存在时，脚本将聚合后的规则内容直接追加到文件末尾，不添加额外包装标题、受控块注释或文件名标题。

追加前脚本会按 Markdown 标题文本去重。若待注入规则与现有 `AGENTS.md` 出现重复标题，脚本必须停止写入并报告重复标题；AI 随后读取现有 `AGENTS.md` 与待注入 references，输出规则合并审查结论，评估应合并、保留、改名还是移动到既有章节。未经审查不得自动跳过、覆盖或重复追加同名章节。

然后基于项目根目录 `AGENTS.md` 创建 `CLAUDE.md` 托管链接：

```bash
node <init-project-skill>/scripts/link-claude.mjs <your-project>
```

脚本会先检测目标目录是否为 Git worktree；若是，则写入仓库本地配置 `core.symlinks=true`，让该仓库优先按符号链接方式记录和还原 `CLAUDE.md`。该配置不能替代 Windows 的符号链接权限；若 Windows 无管理员权限或未启用开发者模式，文件软链接仍可能失败。

脚本优先创建指向 `AGENTS.md` 的相对软链接。若 Windows 无管理员权限或未启用开发者模式导致文件软链接创建失败，脚本会明确创建同目录硬链接并输出说明；不得静默复制文件。若 `CLAUDE.md` 已存在且不是指向 `AGENTS.md` 的软链接或同一文件实体的硬链接，包括指向其它文件的错误软链接或死链，必须停止并报告实际指向，让用户决定；不得覆盖用户文件。

## 初始化 CodeGraph

在目标项目根目录执行：

```bash
cd your-project
codegraph init -i
```

若 `codegraph` 命令不存在，报告 `MISSING`，提示先运行 AIRules 默认安装流程；不得伪造成已初始化。

## 交付检查

- `AGENTS.md` 已包含本次项目背景对应的 AIRules 规则块。
- `docs/map.md`、`docs/architecture/`、`docs/api/_protocol.md` 与对应文档目录索引已创建；已有用户文档未被覆盖。
- 技术栈检测结果已按 `detect-stack.mjs` 的 `stacks`、`references` 和关键 `evidence` 报告。
- `CLAUDE.md` 是指向 `AGENTS.md` 的软链接；Windows 无文件软链接权限时，可为同一文件实体的硬链接，且日志必须说明。
- `codegraph init -i` 已执行并按真实结果报告 `PASS`、`FAIL`、`MISSING` 或 `NOT RUN`。
