---
name: init-project
description: 用于创建新项目、初始化项目、为已有项目首次接入 AIRules、生成项目根 AGENTS.md/CLAUDE.md 或初始化 CodeGraph 时触发。
---

# Init Project

## 触发条件

- 用户创建新项目、初始化项目或首次为已有项目接入 AIRules 时使用。
- 需要生成项目根 `AGENTS.md`/`CLAUDE.md`、创建文档骨架、登记知识源或初始化 CodeGraph 时使用。

## 不适合场景

- 项目已经完成初始化，且用户只要求修改业务代码、普通文档或单个 skill 时不要使用。
- 目标目录、技术栈或写入权限无法确认时，不要猜测或覆盖用户文件。

## 输出边界

- 只修改目标项目根目录的 `AGENTS.md`、`CLAUDE.md`、`airules.knowledge.json`、`docs/` 标准骨架和 CodeGraph 初始化结果。
- 不改依赖目录、构建产物、vendor、宿主目录或用户未授权文件。

## 分析项目背景

开始初始化前，先执行确定性技术栈检测脚本，形成最小项目背景：

```bash
node <init-project-skill>/scripts/detect-stack.mjs <your-project>
```

- 项目类型来自脚本输出的 `stacks` 字段，可能包含 `frontend`、`component-library`、`component-consumer`、`vue`、`node`、`nestjs`、`java`。
- 规则文件来自脚本输出的 `references` 字段。
- 多项目仓库、monorepo 或 workspace 项目必须读取脚本输出的 `monorepo`、`workspacePatterns`、`projects`、`projectRoots` 与 `evidence`；显式 workspace 配置优先，递归项目标记文件作为兜底；`stacks` 用于按所有子项目聚合后注入规则，`projects[].stacks` 用于说明每个子项目分别是前端、后端、组件库或其它类型，不得只根据仓库根目录判断。
- 证据入口来自脚本输出的 `evidence` 字段；交付时保留关键证据，便于用户审计。
- 写入边界：只修改目标项目根目录的 `AGENTS.md` 和 `CLAUDE.md`；不得改动依赖目录、构建产物、vendor 或用户未授权文件。
- 缺失事实：脚本输出空 `stacks` 时，只注入通用 AIRules 基线；不要猜测语言规则。

## 初始化知识源注册表与项目文档骨架

根据技术栈检测结果创建项目知识源注册表和标准文档输出骨架：

```bash
node <init-project-skill>/scripts/scaffold-docs.mjs <your-project> <detect-stack 输出的 stack...>
```

- 所有项目都会在根目录创建 `airules.knowledge.json`，作为行业式知识源注册表；该文件登记可被 AI 检索的项目资料来源，不要求用户把原始资料统一改写成标准 docs。
- 默认注册 `README.md`、`README-zh.md`、`AGENTS.md`、`CLAUDE.md` 和 `docs/**` 作为文件系统知识源，并排除 `vendor/**`、`node_modules/**`、`dist/**`、`coverage/**`、`.git/**`、`.codegraph/**`。
- `airules.knowledge.json` 已存在时不得覆盖；需要新增非文件系统来源时，必须先实现安装、查询、校验和测试合同，不得仅凭名称登记，也不得默认索引整个项目。
- 知识源注册表必须通过 `node <AIRules>/scripts/verify-knowledge-sources.mjs airules.knowledge.json`；校验失败是 `FAIL`，不得降级成 warning。
- 所有项目都会创建 `docs/architecture/`、`docs/api/`、`docs/prds/`、`docs/test/`、`docs/other/` 和 `docs/map.md`。
- `docs/architecture/` 包含 `index.md`、`overview.md` 和 `decisions/index.md`，用于承载架构事实与 ADR。
- `docs/api/` 包含 `index.md` 和 `_protocol.md`，用于承载当前项目消费的外部 API、上游服务或 SDK 契约。
- `component-consumer` 项目额外创建 `docs/components/`，用于承载当前项目消费的外部组件库、Design System、UI SDK 或 workspace 组件包约束。
- `scaffold-docs.mjs` 不生成 `docs/out-components/` 或 `docs/out-api/`；对外复用产物必须分别由 `components-docs`、`api-docs` 基于自维护文档、源码和已有契约推导生成。
- 如果项目已有文档必须先判断归属；能确定属于架构、接口、需求、测试或外部组件库的，保留为登记知识源和已知归属来源，按“对应文档 Skills”转成标准格式；无法确定归属的移动到 `docs/other/imported/` 并在 `docs/other/index.md` 标记为 `MISSING conversion`。
- 已有接口或组件文档必须再判断 ownership：当前项目提供的 API/组件库输出到 `docs/out-api/` 或 `docs/out-components/`；当前项目消费的外部 API/组件库输出到 `docs/api/` 或 `docs/components/`；无法确认时标记 `MISSING ownership`。
- 归档前必须识别特殊文档目录；例如 `docs/superpowers/` 属于外部方法论/参考资料目录，必须原位保留，不得移动到 `docs/other/imported/`，也不得作为待转换业务文档登记。
- 无法归类文档的归档目标已存在时，脚本必须停止并报告冲突；不得覆盖、合并或部分移动。
- 已 AIRules 初始化的项目重复执行时，脚本只补缺失标准入口，不覆盖用户已有标准文档。

## 对应文档 Skills

旧文档标准化、文档更新和对外产物生成必须按内容类型调用对应 skill；不得只写“使用对应 skill”而不说明对应关系：

- `architecture-docs`：架构边界、分层、依赖方向、部署拓扑、权限模型、技术选型、ADR。
- `knowledge-search`：通过 `airules.knowledge.json` 和登记文件系统来源查找项目知识和证据，不写正式文档。
- `prd-docs`：业务背景、用户流程、字段口径、状态流转、验收标准、需求变更。
- `api-docs`：当前项目提供的 API 输出到 `docs/out-api/`；当前项目消费的外部 API、上游服务、SDK 或 generated client 输出到 `docs/api/`。
- `components-docs`：当前项目提供的组件库输出到 `docs/out-components/`；当前项目消费的外部组件库、Design System、UI SDK 或 workspace 组件包输出到 `docs/components/`。
- `test-docs`：测试策略、用例矩阵、回归范围、联调验证、Mock/fixture、测试数据准备、前端交互测试设计。
- `frontend-impl-plan`、`backend-impl-plan`：测试设计就绪后、写代码前的实现计划/任务书；前端方案（组件复用、布局、状态、API 调用）用 `frontend-impl-plan`，后端方案（数据模型、接口设计、分层、事务一致性）用 `backend-impl-plan`，前后端不混写。


## 根据项目背景注入规则

执行脚本时会按目标项目现状注入规则：

- 当 `AGENTS.md` 不存在或为空时，先注入 `references/airules-base.md`，为用户创建 `# 项目规范` 与项目自定义规范占位。
- 当 `AGENTS.md` 已存在且包含用户内容时，跳过 `references/airules-base.md`，避免向用户已有规范中追加占位段。
- 始终注入 `references/common/control.md`、`references/common/docs.md` 和 `references/common/subagent.md`，再按检测结果选择场景输出规范与语言代码规范，并注入目标项目根目录 `AGENTS.md`。
- `references/common/control.md` 承载变更分级（L0/L1/L2）、澄清门禁和开发链路控制（含 need→契约→测试设计→实现计划→编码→验证→评审的链式前置门禁），是各宿主 agent 获得需求-计划-测试-评审全程可控能力的入口；不得跳过注入。
- `references/common/subagent.md` 承载子代理委派规则和后置子代理评审/校验（实现编码后强制独立子代理评审代码质量、文档产物的可控性后置校验）；不得跳过注入。
- `references/` 按 `common/`、`frontend/`、`backend/` 组织：通用文档读取规则只放在 `common/docs.md`；组件库对外输出规则放在 `frontend/out-components.md`；外部组件库消费规则放在 `frontend/components.md`；后端 API 提供方与消费方规则放在 `backend/out-api.md`；各领域通用代码规则命名为 `code.md`，具体框架或语言规则使用 `vue.md`、`node.md`、`nestjs.md`、`java.md`。

| `detect-stack.mjs` 输出 stack | 追加注入 references |
|---|---|
| `frontend` | `frontend/code.md` |
| `component-library` | `frontend/out-components.md` |
| `component-consumer` | `frontend/components.md` |
| `vue` | `frontend/vue.md` |
| `node` | `backend/out-api.md`、`backend/node.md` |
| `nestjs` | `backend/out-api.md`、`backend/nestjs.md` |
| `java` | `backend/out-api.md`、`backend/java.md` |

执行内容注入脚本：

```bash
node <init-project-skill>/scripts/inject-rules.mjs <your-project> <init-project-skill>/references/common/docs.md [...]
node <init-project-skill>/scripts/inject-rules.mjs <your-project> <init-project-skill>/references/<group>/<rule>.md [...]
```

无法判断技术栈时不传额外语言规则，脚本仍会自动注入 `airules-base.md`（仅新建或空 `AGENTS.md` 时）、`common/control.md`、`common/docs.md` 和 `common/subagent.md`，无需在命令中手动传入这四个文件。当目标项目不存在 `AGENTS.md` 时，脚本创建该文件；当文件已存在时，脚本将聚合后的规则内容直接追加到文件末尾，不添加额外包装标题、受控块注释或文件名标题。

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
- `airules.knowledge.json` 已创建或保留，并通过 `verify-knowledge-sources.mjs` 校验；知识源只包含登记文件系统路径，未默认索引整个项目。
- `docs/map.md`、`docs/architecture/`、`docs/api/_protocol.md`、`docs/other/` 与对应文档目录索引已创建；`component-consumer` 项目已创建 `docs/components/`；旧文档已按归属转换到标准目录，无法确定归属的才归档到 `docs/other/imported/`。
- 重复初始化时已按当前 AIRules 最新规范检查 `docs/`；需要语义迁移或标准化更新的文档已使用对应 docs skill 处理，需开发者确认的项已输出标准化更新报告。
- 若存在旧文档，已按标准分类转换到 `docs/prds/`、`docs/api/`、`docs/test/`、`docs/architecture/`；组件库旧文档应通过 `components-docs` 判断 ownership 后转换到 `docs/components/` 或 `docs/out-components/`；无法转换的条目已标记 `MISSING conversion`。
- 组件库项目已通过 `components-docs` 优先读取组件库自维护文档，并按 AIRules 输出位置、文档结构、必备字段、来源证据和 `MISSING` 语义完成合规校验；缺少自维护文档、自维护文档不合规或公开组件存在文档缺口时，已生成、标准化或更新 `docs/out-components/`，无法确认时已报告 `MISSING component docs coverage`、`MISSING component docs drift` 或 `MISSING components discovery`。
- 组件消费项目已通过 `components-docs` 优先读取外部组件库官方文档、依赖包自维护文档和本项目已有封装规则，并按 AIRules 输出位置、文档结构、必备字段、来源证据和 `MISSING` 语义完成合规校验；缺少消费方文档或已有文档不合规时已生成、标准化或更新 `docs/components/`，未发现外部组件库时已报告 `MISSING component dependency` 和扫描范围。
- 后端 API 项目已通过 `api-docs` 分析路由、DTO/schema、OpenAPI/Swagger、测试、外部 client、SDK/generated client、Mock 和已有接口文档；当前项目提供的接口已生成或更新 `docs/out-api/`，当前项目消费的外部接口已生成或更新 `docs/api/`，未发现接口时已报告 `MISSING API contract` 和扫描范围。
- 技术栈检测结果已按 `detect-stack.mjs` 的 `stacks`、`references` 和关键 `evidence` 报告。
- `CLAUDE.md` 是指向 `AGENTS.md` 的软链接；Windows 无文件软链接权限时，可为同一文件实体的硬链接，且日志必须说明。
- `codegraph init -i` 已执行并按真实结果报告 `PASS`、`FAIL`、`MISSING` 或 `NOT RUN`。
