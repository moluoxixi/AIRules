# Moluoxixi AIRules

简体中文 | [English](README-en.md)

AIRules 为 AI 编程宿主分发带版本的角色能力。一个 role 不只是“一组提示词”，而是由共享 skills、MCP servers、角色 CLI、项目工作流、agents、hooks 和运行时资产组成的可安装组合。

先区分两个安装层级：

- `airules install <role>` 安装用户级资产：拉取固定版本的 vendor、组合 capabilities、把 skills 投影到 `~/.agents/skills`、合并宿主 MCP 配置，并安装角色声明的 CLI package。
- `init-project` 安装项目级资产：调用角色原生 CLI，在当前仓库生成 `.moluoxixi/` 或 `.trellis/`，再补装 AIRules 的知识库和中文兼容扩展。

AIRules 安装器负责用户级 package setup、资产分发和受管 skills/MCP 校验，但不调度 agents。agents 的派发权属于初始化后的 Moluoxixi/Trellis 主工作流，hooks 负责注入状态和上下文，skills 才负责语义分析与文件修改。

## `moluoxixi`

适合希望获得完整 AI 开发流程，同时需要 Moluoxixi 原生 CLI、项目知识库、多领域 skills 和可控多 agent 调度的用户。

### 安装

```bash
npm install --global moluoxixi-ai-rules
airules install moluoxixi --host all
airules verify moluoxixi --host all
```

`airules install moluoxixi` 会自动安装 Moluoxixi core 和全局 CLI，可用两个命令名：

```bash
moluoxixi --version
ml --version
```

只有在不安装完整 role、或需要单独修复 CLI 时，才需要直接安装角色包：

```bash
npm install --global @moluoxixi/airules-moluoxixi-cli
```

### 功能

#### 安装后的资产

| 层级 | 资产 | 作用 |
| --- | --- | --- |
| 用户级角色资产 | Moluoxixi core、`moluoxixi`/`ml` CLI、`init-project` | 提供原生项目初始化、更新、任务、memory、workflow 和 channel 命令 |
| 公共 capability | `common`、`coding`、`productivity`、`frontend` | 组合共享 skills、外部固定版本 skills 和 MCP servers |
| 原生项目资产 | `.moluoxixi/workflow.md`、`tasks/`、`spec/`、`scripts/`、`agents/`、宿主配置 | 保存工作流状态、任务工件、项目规范和 agent 定义 |
| AIRules 项目扩展 | `.moluoxixi/knowledge/`、知识 runtime、宿主 knowledge hook、`moluoxixi-knowledge` | 检测 source 变化，维护可追踪的项目知识库 |

共享 skills 以 `~/.agents/skills` 为 canonical 目录。能够直接发现该目录的宿主不会再复制一份；需要私有 skill 目录的宿主由 AIRules 建立受管投影。

#### Skills

项目工作流入口会按宿主能力生成为 slash command 或可发现 skill；下表使用统一的逻辑名称。

| 来源 | Skill | 做什么 |
| --- | --- | --- |
| 角色入口 | `init-project` | 调用已安装的 Moluoxixi CLI 初始化当前项目，再安装知识库、宿主 hooks 和中文任务约定 |
| 项目工作流 | `moluoxixi-start` | 读取开发者、Git、当前任务和项目规范，判断新需求应直接修改还是进入任务流程 |
| 项目工作流 | `moluoxixi-brainstorm` | 在实现前澄清需求、取舍和 MVP，形成 PRD、设计与实施计划 |
| 项目工作流 | `moluoxixi-before-dev` | 开发前读取当前任务工件和相关 `.moluoxixi/spec/` 规范 |
| 项目工作流 | `moluoxixi-continue` | 根据任务 phase index 恢复未完成工作，定位下一步 |
| 项目工作流 | `moluoxixi-check` | 检查 spec 一致性、lint、类型、测试、跨层数据流和改动范围 |
| 项目工作流 | `moluoxixi-break-loop` | 在修复反复出现的 bug 后分析根因，并形成防复发机制 |
| 项目工作流 | `moluoxixi-update-spec` | 把调试、实现和讨论中确认的可执行契约写入项目 spec |
| 项目工作流 | `moluoxixi-finish-work` | 核对质量门禁、提醒提交、归档任务并记录开发日志 |
| 项目工作流 | `moluoxixi-channel` | 通过 `moluoxixi channel` 启动、观察和协调实时多 agent worker |
| 项目工作流 | `moluoxixi-session-insight` | 通过 `moluoxixi mem` 检索过去会话中的决定和解决方案 |
| 项目工作流 | `moluoxixi-spec-bootstrap` | 从真实代码建立或刷新项目专属 coding specs |
| 项目工作流 | `moluoxixi-meta` | 理解和定制 `.moluoxixi/`、宿主 hooks、agents、skills 与 workflow 模板 |
| 知识扩展 | `moluoxixi-knowledge` | 把 `knowledge/sources/` 整理为 library 页面，更新 `index.md` 和 `relations.json`，通过一致性门禁后确认批次 |
| `common` | `create-skill` | 创建或修订可复用的 agent skill |
| `common` | `spec-organization` | 重组 spec 目录、命名、索引和链接 |
| `frontend` | `frontend-design` | 为新 UI 或现有界面重塑提供有明确审美方向的设计指导 |
| `productivity` | `grill-me` | 启动严格访谈，把模糊想法推进到可执行方案 |
| `productivity` | `grilling` | 压力测试计划、决策或设计中的薄弱假设 |
| `productivity` | `handoff` | 把当前对话压缩为下一位 agent 可接手的交接文档 |
| `productivity` | `teach` | 在当前仓库中进行可跨会话记录状态的教学 |
| `productivity` | `to-questionnaire` | 把 agent 无法独立回答的决策转成给知情人的问卷 |
| `productivity` | `wait-what` | 用更直接的技术英语重新解释未被理解的内容 |
| `productivity` | `writing-for-agents` | 编写供 agent 消费的 skills、`AGENTS.md` 和 `CLAUDE.md` |

`coding` capability 安装 CodeGraph、Context7、Sequential Thinking MCP；`frontend` capability 安装 Playwright MCP。前者分别用于代码关系探索、库文档查询和结构化推理，后者用于浏览器检查与自动化。

#### Agents、hooks 与调度

| Agent | 职责 | 写入边界 |
| --- | --- | --- |
| `moluoxixi-research` | 跨文件研究代码、规范和方案，为计划提供证据 | 只写当前任务的 `research/`，其余只读 |
| `moluoxixi-implement` | 按 PRD/design/implement 实现并运行 lint、typecheck、tests | 修改实现，不提交，不递归派发 agent |
| `moluoxixi-check` | 独立审查 diff、spec、测试和范围；可修复机械问题 | 修改检查范围内文件，不提交，不递归派发 agent |

主会话拥有唯一派发权。自动调度时，研究型问题可先派 `research`，进入执行阶段后按 `implement -> check -> update-spec -> commit -> finish-work` 收敛；`dispatch_mode: inline` 时，主会话直接执行 `before-dev -> edit -> check`。`moluoxixi channel spawn --agent <name>` 会加载 `.moluoxixi/agents/` 中的定义，supervisor 通过事件日志连接 worker 与主会话。

hooks 不替代 skills：

```text
UserPrompt/SessionStart
  -> workflow-state hook 读取活动任务和 workflow.md
  -> knowledge-hook.py 调用 common/knowledge.py 读取 index + status
  -> 将当前 phase、任务、受影响知识资产注入主会话
  -> 主会话按需调用 workflow/knowledge skill

SubagentStart
  -> subagent-context hook 识别 research/implement/check
  -> 注入任务 JSONL、PRD、design、implement 和相关 spec
```

知识 Hook 只做确定性扫描和上下文注入，不会启动另一个 AI，也不会直接改 library。`moluoxixi-knowledge` 负责语义整理；`relations.json` 是机器关系的唯一事实源，记录每个 canonical asset 依赖的一个或多个 sources，运行时据此构建 source-to-assets 反向索引。

### 用法

首次在项目中启用完整工作流和知识库时，在目标 AI 宿主中发送：

```text
请使用 init-project 初始化当前项目的 Moluoxixi 工作流，目标宿主为 Codex。
```

之后的典型路径是：

```text
描述需求
  -> start 判断任务类型
  -> brainstorm 形成 PRD/design/implement
  -> task start
  -> research（需要时）
  -> implement
  -> check
  -> update-spec
  -> 用户确认提交
  -> finish-work
```

资料放入 `.moluoxixi/knowledge/sources/` 后，每轮 Hook 会检查变化。存在待整理 source 时，AI 先运行 `moluoxixi-knowledge`，更新 library、索引和关系账本，再继续主任务。

`init-project` 只在首次接入、增加/重新配置宿主或补装扩展时使用。只使用共享 skills 或 CLI 时可以不运行；直接执行 `moluoxixi init` 只安装原生项目资产，不包含 AIRules 知识扩展。

角色源码位于 [`roles/moluoxixi`](roles/moluoxixi)。

## `matt`

适合只想安装 Matt Pocock 的工程方法和效率 skills，不需要固定项目工作流、项目 agents、hooks、MCP 或角色 CLI 的用户。

### 安装

```bash
npm install --global moluoxixi-ai-rules
airules install matt --host all
airules verify matt --host all
```

### 功能

#### 安装后的资产

`matt` 只组合 `engineering` 和 `productivity` 两个 capability。它安装固定上游版本的 skills，但不创建 `.matt/`，没有 role-owned `init-project`、agents、hooks、CLI 或 MCP server。

#### Skills

| Capability | Skill | 做什么 |
| --- | --- | --- |
| `engineering` | `ask-matt` | 根据当前问题选择适合的 Matt skill 或工作流；这是显式调用的路由器 |
| `engineering` | `code-review` | 从指定基线对改动做 standards 与 spec 双轴审查 |
| `engineering` | `codebase-design` | 用深模块原则改进模块边界、接口和可测试性 |
| `engineering` | `diagnosing-bugs` | 系统诊断疑难 bug、性能问题或回归 |
| `engineering` | `domain-modeling` | 建立或修订领域模型、`CONTEXT.md` 和 ADR |
| `engineering` | `grill-with-docs` | 通过访谈打磨设计，并同步产出 ADR 与词汇文档 |
| `engineering` | `implement` | 按已有 spec 或 tickets 实施工作 |
| `engineering` | `improve-codebase-architecture` | 扫描架构深化机会，生成报告并推进取舍 |
| `engineering` | `prototype` | 用一次性原型回答设计、状态模型或 UI 问题 |
| `engineering` | `research` | 依据一手来源研究，并将结果写入仓库 Markdown |
| `engineering` | `resolving-merge-conflicts` | 处理进行中的 merge/rebase 冲突并运行检查 |
| `engineering` | `setup-matt-pocock-skills` | 首次配置 issue tracker、triage labels 和领域文档布局 |
| `engineering` | `tdd` | 以 red-green-refactor 方式进行测试驱动开发 |
| `engineering` | `to-spec` | 把当前对话整理为 spec，并发布到 issue tracker |
| `engineering` | `to-tickets` | 把计划或 spec 拆成有依赖关系的 tracer-bullet tickets |
| `engineering` | `triage` | 核验并分类 issue/外部 PR，生成 agent-ready brief |
| `engineering` | `wayfinder` | 把超出单次会话的大型工作规划成决策与 ticket 地图 |
| `engineering` | `wizard` | 生成交互式 bash wizard，引导人工完成凭据、控制台或迁移步骤 |
| `productivity` | `grill-me` | 启动严格访谈，把模糊计划推进到可执行状态 |
| `productivity` | `grilling` | 压力测试计划、决策或设计 |
| `productivity` | `handoff` | 生成下一位 agent 可直接接手的交接文档 |
| `productivity` | `teach` | 在仓库中进行可记录进度的跨会话教学 |
| `productivity` | `to-questionnaire` | 把未决问题转成面向知情人的问卷 |
| `productivity` | `wait-what` | 重新解释没有被理解的信息 |
| `productivity` | `writing-for-agents` | 编写 agent 消费的文档和 skills |

#### 调度方式

`matt` 没有项目级 agent scheduler。AI 宿主根据每个 `SKILL.md` 的 description 发现可用 skill；带有手动调用约束的 skills 不会被保证自动触发。选择不明确时显式要求使用 `ask-matt`，比假设 AIRules 会自动编排更准确。

### 用法

无需运行 `init-project`，直接描述工程目标或显式点名 skill。例如：

```text
请使用 ask-matt 判断这个需求应该走哪条工程工作流。
请使用 diagnosing-bugs 分析这个性能回归的根因。
请把当前方案 to-spec，再用 to-tickets 拆成可并行任务。
请使用 tdd 实现这个行为，最后运行 code-review。
```

一条典型链路是 `setup-matt-pocock-skills -> to-spec -> to-tickets -> implement -> code-review`；单点问题则直接使用对应 skill。所有状态由当前宿主、仓库文档或 issue tracker 管理，AIRules 不创建 `.matt/`。

角色源码位于 [`roles/matt`](roles/matt)。

## `trellis`

适合希望使用原生 Trellis 的任务与规范驱动工作流，同时获得 AIRules 共享 skills、MCP、知识库和多 agent 调度的用户。

### 安装

```bash
npm install --global moluoxixi-ai-rules
airules install trellis --host all
airules verify trellis --host all
trellis --version
```

`airules install trellis` 会安装 Trellis CLI 和用户级能力，但不会自动修改任何项目；项目级工作流由下一步的 `init-project` 创建。

### 功能

#### 安装后的资产

| 层级 | 资产 | 作用 |
| --- | --- | --- |
| 用户级角色资产 | Trellis CLI、`init-project` | 提供原生 `init/update/upgrade/uninstall/mem/workflow/platforms/channel` 命令 |
| 公共 capability | `common`、`coding`、`productivity`、`frontend` | 与 Moluoxixi 相同的共享 skills、外部固定版本 skills 和 MCP servers |
| 原生项目资产 | `.trellis/workflow.md`、`tasks/`、`spec/`、`scripts/`、`agents/`、宿主配置 | 保存 Plan/Execute/Finish 状态、任务工件、规范和 agent 定义 |
| AIRules 项目扩展 | `.trellis/knowledge/`、知识 runtime、宿主 hook、`trellis-knowledge` | 自动发现 source 变化并维护双向可追踪知识关系 |

#### Skills

原生 Trellis 会按宿主能力把工作流入口投影为 command 或 skill；下表使用统一的 skill 名称说明其职责。

| 来源 | Skill | 做什么 |
| --- | --- | --- |
| 角色入口 | `init-project` | 运行原生 `trellis init`，再补装知识库、README 用法和简体中文任务约定 |
| 项目工作流 | `trellis-start` | 建立开发 session，读取身份、Git、任务和规范并选择工作路径 |
| 项目工作流 | `trellis-brainstorm` | 澄清新功能或复杂需求，创建 PRD、设计和实施计划 |
| 项目工作流 | `trellis-before-dev` | 在写代码前注入适用的项目 coding guidelines |
| 项目工作流 | `trellis-continue` | 读取 phase index 并恢复当前任务 |
| 项目工作流 | `trellis-check` | 执行 spec、lint、类型、测试、复用与跨层一致性检查 |
| 项目工作流 | `trellis-break-loop` | 对重复 bug 做根因分类并建立防复发机制 |
| 项目工作流 | `trellis-update-spec` | 把已经确认的契约和编码约定固化到 `.trellis/spec/` |
| 项目工作流 | `trellis-finish-work` | 核对质量门禁、归档任务并写开发日志 |
| 项目工作流 | `trellis-channel` | 通过 Trellis channel runtime 管理实时多 agent 协作 |
| 项目工作流 | `trellis-session-insight` | 使用 `trellis mem` 检索历史会话中的决定和解决方案 |
| 项目工作流 | `trellis-spec-bootstrap` | 从真实代码建立或刷新项目规范 |
| 项目工作流 | `trellis-meta` | 理解和定制 `.trellis/`、平台 hooks、agents、skills 与 workflow |
| 知识扩展 | `trellis-knowledge` | 整理 `.trellis/knowledge/sources/`，更新 library/index/relations 并确认稳定批次 |
| `common` | `create-skill` | 创建或修订可复用的 agent skill |
| `common` | `spec-organization` | 重组项目 specification 文档及索引 |
| `frontend` | `frontend-design` | 指导有明确视觉方向的前端设计与重塑 |
| `productivity` | `grill-me` | 启动严格需求访谈 |
| `productivity` | `grilling` | 压力测试计划、决策或设计 |
| `productivity` | `handoff` | 生成跨 agent 交接文档 |
| `productivity` | `teach` | 进行可记录进度的跨会话教学 |
| `productivity` | `to-questionnaire` | 把未决问题转成问卷 |
| `productivity` | `wait-what` | 重新解释未被理解的内容 |
| `productivity` | `writing-for-agents` | 编写 agent 文档与 skills |

Trellis 同样安装 CodeGraph、Context7、Sequential Thinking 和 Playwright MCP；role-owned MCP 清单为空，实际 MCP 来自 `coding` 与 `frontend` capabilities。

#### Agents、hooks 与调度

| Agent | 职责 | 调度时机 |
| --- | --- | --- |
| `trellis-research` | 研究代码、spec 和技术方案，只向任务 `research/` 写证据 | Plan 阶段或执行前需要外部研究时 |
| `trellis-implement` | 按任务工件实现并运行基本检查 | Execute 阶段 |
| `trellis-check` | 独立检查实现，可修机械问题并重新验证 | implement 之后、提交之前 |

主会话默认按 `trellis-implement -> trellis-check` 派发，research 按需插入。子代理提示首行携带 `Active task`，hook 再按 `JSONL -> prd.md -> design.md -> implement.md -> spec` 注入上下文；implement/check 不能互相或递归派发。`dispatch_mode: inline` 时由主会话直接执行 `trellis-before-dev -> edit -> trellis-check`。

Plan 阶段创建并确认 PRD，复杂任务补齐 design/implement 后 `task.py start`；Execute 阶段实施与检查；Finish 阶段运行 break-loop（需要时）、update-spec、用户确认提交和 finish-work。channel runtime 还可以显式加载 `.trellis/agents/implement.md` 或 `check.md` 作为长驻 worker。

知识调用链与 Moluoxixi 相同，只是根目录和 skill 名不同：宿主事件调用 `knowledge-hook.py`，公共 scanner 计算 source diff、受影响 assets 和关系错误，Hook 注入 `<trellis-knowledge>`；`trellis-knowledge` 再负责实际整理和 acknowledge。

### 用法

首次在项目中启用完整工作流和知识库时发送：

```text
请使用 init-project 初始化当前项目的 Trellis 工作流，开发者名称为 wl，目标宿主为 Codex。
```

日常通过工作流入口推进：

```text
请使用 Trellis 开始处理这个需求：<描述需求>
请使用 Trellis 继续当前任务。
请使用 Trellis 检查当前改动。
请使用 Trellis 完成本次工作。
```

整体链路是“规划（Plan）→ 执行（Execute）→ 完成（Finish）”。资料放在 `.trellis/knowledge/sources/`；Hook 检测到变化后会先路由到 `trellis-knowledge`，修复 library 与关系账本后再进入主任务。

`init-project` 只在首次接入、增加宿主或重新配置时使用。如果只使用该 role 的共享 skills/MCP，可以不运行它。

角色源码位于 [`roles/trellis`](roles/trellis)。

## 公共分发机制

Role 只声明 capability，registry 负责按声明顺序组合 vendor，合并兼容投影、去重完全相同的 projection，并拒绝来源或目标冲突。完整映射见 [capabilities/README.md](capabilities/README.md)。

分发链路为：

```text
role manifest
  -> 固定 vendor checkout / package setup
  -> vendor staging
  -> canonical ~/.agents/skills
  -> 宿主 skill 投影与 MCP 合并
```

当前安装 role 的受管 shared layer 会替换上一 role 不再需要的受管链接，因此不要把三个 role 理解为完全隔离、永久叠加的环境。用户已有的同名 MCP 配置优先保留。`airules verify` 检查受管 skills、宿主 links 和 MCP server 名称，不检查项目初始化器生成的 agents/hooks；后者应通过角色工作流自身的检查完成。

## 开发

```bash
npm install
npm test
npm run typecheck
npm run lint:check
```

## 许可证

MIT
