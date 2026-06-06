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

- 项目类型来自脚本输出的 `stacks` 字段，可能包含 `frontend`、`component-library`、`vue`、`node`、`nestjs`、`java`。
- 规则文件来自脚本输出的 `references` 字段。
- 多项目仓库、monorepo 或 workspace 项目必须读取脚本输出的 `monorepo`、`workspacePatterns`、`projects`、`projectRoots` 与 `evidence`；显式 workspace 配置优先，递归项目标记文件作为兜底；`stacks` 用于按所有子项目聚合后注入规则，`projects[].stacks` 用于说明每个子项目分别是前端、后端、组件库或其它类型，不得只根据仓库根目录判断。
- 证据入口来自脚本输出的 `evidence` 字段；交付时保留关键证据，便于用户审计。
- 写入边界：只修改目标项目根目录的 `AGENTS.md` 和 `CLAUDE.md`；不得改动依赖目录、构建产物、vendor 或用户未授权文件。
- 缺失事实：脚本输出空 `stacks` 时，只注入通用 AIRules 基线；不要猜测语言规则。

## 初始化项目文档骨架

根据技术栈检测结果创建项目文档知识库骨架：

```bash
node <init-project-skill>/scripts/scaffold-docs.mjs <your-project> <detect-stack 输出的 stack...>
```

- 所有项目都会创建 `docs/architecture/`、`docs/api/`、`docs/prds/`、`docs/test/`、`docs/other/` 和 `docs/map.md`。
- `docs/architecture/` 包含 `index.md`、`overview.md` 和 `decisions/index.md`，用于承载架构事实与 ADR。
- `docs/api/` 包含 `index.md` 和 `_protocol.md`，用于承载全局接口协议与业务接口索引。
- 前端组件库项目额外创建 `docs/components/` 作为外部组件库文档。
- `scaffold-docs.mjs` 不生成 `out-components/` 或 `out-api/`；对外复用产物必须分别由 `components-docs`、`api-docs` 基于源码和已有文档推导生成。
- 如果项目已有文档必须先判断归属；能确定属于架构、接口、需求、测试或外部组件库的，保留为已知归属来源，按“对应文档 Skills”转成标准格式；无法确定归属的移动到 `docs/other/imported/` 并在 `docs/other/index.md` 标记为 `MISSING conversion`。
- 归档前必须识别特殊文档目录；例如 `docs/superpowers/` 属于外部方法论/参考资料目录，必须原位保留，不得移动到 `docs/other/imported/`，也不得作为待转换业务文档登记。
- 无法归类文档的归档目标已存在时，脚本必须停止并报告冲突；不得覆盖、合并或部分移动。
- 已 AIRules 初始化的项目重复执行时，脚本只补缺失标准入口，不覆盖用户已有标准文档。

## 对应文档 Skills

旧文档标准化、文档更新和对外产物生成必须按内容类型调用对应 skill；不得只写“使用对应 skill”而不说明对应关系：

- `architecture-docs`：架构边界、分层、依赖方向、部署拓扑、权限模型、技术选型、ADR。
- `prd-docs`：业务背景、用户流程、字段口径、状态流转、验收标准、需求变更。
- `api-docs`：接口协议、路由、DTO/schema、OpenAPI/Swagger、错误码、分页、鉴权、Mock、联调说明、`out-api/`。
- `components-docs`：组件库公共组件、Props/Events/Slots/Children、可访问性、示例、版本兼容、`out-components/`。
- `test-docs`：测试策略、用例矩阵、回归范围、联调验证、Mock/fixture、测试数据准备。


## 根据项目背景注入规则

执行脚本时会按目标项目现状注入规则：

- 当 `AGENTS.md` 不存在或为空时，先注入 `references/airules-base.md`，为用户创建 `# 项目规范` 与项目自定义规范占位。
- 当 `AGENTS.md` 已存在且包含用户内容时，跳过 `references/airules-base.md`，避免向用户已有规范中追加占位段。
- 始终注入 `references/common/docs.md`，再按检测结果选择场景输出规范与语言代码规范，并注入目标项目根目录 `AGENTS.md`。
- `references/` 按 `common/`、`frontend/`、`backend/` 组织：通用文档读取规则只放在 `common/docs.md`；前端 `docs.md` 只描述组件库 `out-components/` 输出；后端 `docs.md` 只描述 API `out-api/` 输出；各领域通用代码规则命名为 `code.md`，具体框架或语言规则使用 `vue.md`、`node.md`、`nestjs.md`、`java.md`。

| `detect-stack.mjs` 输出 stack | 追加注入 references |
|---|---|
| `frontend` | `frontend/code.md` |
| `component-library` | `frontend/docs.md` |
| `vue` | `frontend/vue.md` |
| `node` | `backend/docs.md`、`backend/node.md` |
| `nestjs` | `backend/docs.md`、`backend/nestjs.md` |
| `java` | `backend/docs.md`、`backend/java.md` |

执行内容注入脚本：

```bash
node <init-project-skill>/scripts/inject-rules.mjs <your-project> <init-project-skill>/references/common/docs.md [...]
node <init-project-skill>/scripts/inject-rules.mjs <your-project> <init-project-skill>/references/<group>/<rule>.md [...]
```

无法判断技术栈时不传额外语言规则，脚本只注入 `airules-base.md` 和 `common/docs.md`。当目标项目不存在 `AGENTS.md` 时，脚本创建该文件；当文件已存在时，脚本将聚合后的规则内容直接追加到文件末尾，不添加额外包装标题、受控块注释或文件名标题。

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
- `docs/map.md`、`docs/architecture/`、`docs/api/_protocol.md`、`docs/other/` 与对应文档目录索引已创建；旧文档已按归属转换到标准目录，无法确定归属的才归档到 `docs/other/imported/`。
- 重复初始化时已按当前 AIRules 最新规范检查 `docs/`；需要语义迁移或标准化更新的文档已使用对应 docs skill 处理，需开发者确认的项已输出标准化更新报告。
- 若存在旧文档，已按标准分类转换到 `docs/prds/`、`docs/api/`、`docs/test/`、`docs/architecture/`，组件库项目还应转换到 `docs/components/` 或 `out-components/`；无法转换的条目已标记 `MISSING conversion`。
- 组件库项目已通过 `components-docs` 扫描组件库源码；发现到的所有组件均已生成或更新 `out-components/`，未发现组件时已报告 `MISSING components discovery` 和扫描范围。
- 后端 API 项目已通过 `api-docs` 分析路由、DTO/schema、OpenAPI/Swagger、测试和已有接口文档；发现到的对外接口均已生成或更新 `out-api/`，未发现接口时已报告 `MISSING API contract` 和扫描范围。
- 技术栈检测结果已按 `detect-stack.mjs` 的 `stacks`、`references` 和关键 `evidence` 报告。
- `CLAUDE.md` 是指向 `AGENTS.md` 的软链接；Windows 无文件软链接权限时，可为同一文件实体的硬链接，且日志必须说明。
- `codegraph init -i` 已执行并按真实结果报告 `PASS`、`FAIL`、`MISSING` 或 `NOT RUN`。
