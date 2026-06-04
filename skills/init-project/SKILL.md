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

## 根据项目背景注入规则

执行脚本时始终先自动注入 `references/airules-base.md`，再按检测结果选择语言规则文件，并注入目标项目根目录 `AGENTS.md`：

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

然后基于项目根目录 `AGENTS.md` 创建 `CLAUDE.md` 软链接：

```bash
node <init-project-skill>/scripts/link-claude.mjs <your-project>
```

若 `CLAUDE.md` 已存在且不是指向 `AGENTS.md` 的软链接，必须停止并让用户决定，不得覆盖用户文件。

## 初始化 CodeGraph

在目标项目根目录执行：

```bash
cd your-project
codegraph init -i
```

若 `codegraph` 命令不存在，报告 `MISSING`，提示先运行 AIRules 默认安装流程；不得伪造成已初始化。

## 交付检查

- `AGENTS.md` 已包含本次项目背景对应的 AIRules 规则块。
- 技术栈检测结果已按 `detect-stack.mjs` 的 `stacks`、`references` 和关键 `evidence` 报告。
- `CLAUDE.md` 是指向 `AGENTS.md` 的软链接。
- `codegraph init -i` 已执行并按真实结果报告 `PASS`、`FAIL`、`MISSING` 或 `NOT RUN`。
