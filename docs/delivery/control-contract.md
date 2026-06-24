# AIRules 交付控制契约

> 本文件是 AIRules 可分发包的交付控制契约，由 `scripts/verify-delivery-control.mjs` 校验其完整性。
> 它声明三层控制面、变更分级闸门、澄清触发机制、环节控制矩阵与质量门禁如何协同，
> 确保每个分发到下游宿主的代理都获得一致的可控交付能力。

## 三层控制面

AIRules 的控制能力由三层资产协同构成，缺一不可：

| 控制面 | 载体 | 职责 |
|---|---|---|
| 规则层 | `rules/AGENTS.md`（由 `rules/sources/*.md` 拼接） | 投影到消费方/宿主上下文后始终生效的红线：代码纪律、交付验证、变更分级、澄清门禁、子代理调度、后置评审；在本仓库编辑 `rules/` 时仍按待生成数据处理 |
| 技能层 | `skills/*/SKILL.md` | 触发式工作流：prd/architecture/api/components/test/impl-plan/init-project 等环节资产 |
| 执行层 | `scripts/verify-*.mjs`、`package.json` 脚本 | 确定性校验与编排：frontmatter、知识源、链式门禁、交付契约 |

规则层定义「必须遵守什么」，技能层定义「某环节怎么做」，执行层把软约定转成可执行、可阻断的门禁。

## 变更分级闸门

任何生成、修改、删除动作开始前，先判定变更级别 L0、L1 或 L2，并在交付中说明判定依据；无法判定时按更高一级处理：

- L0：在既有口径、契约或模式内补充，不改变任何对外事实。可直接执行。
- L1：在既有边界内新增或修改，不触及对外口径、公共协议、模块边界、权限、状态机、数据一致性或安全边界。可直接执行，附级别判定依据与验证结果。
- L2：触及需求口径、架构边界、公共协议、权限模型、状态机、数据一致性、安全边界、跨模块行为，或修改 rules、skills、初始化流程、默认分发配置。必须先完成澄清门禁并输出报告或计划，等待用户确认后才能执行。

同一动作横跨多级时按较高一级处理。

## 澄清触发机制

触发条件：命中 L2，或目标、角色、边界、流程、字段、状态、验收标准、冲突、风险中任一关键事实缺失（`MISSING`）或存在多个合理解释（歧义）。

触发后必须先输出《澄清问题清单》或对应设计报告，用苏格拉底式问题逐项暴露上述维度；未确认内容保留为 `MISSING`，不得用推断、默认值或代码反推替代。澄清未闭环前不得定稿、不得写入正式产物、不得声明完成。

## 环节控制矩阵

开发链路按环节选择控制资产，下游环节默认依赖上游产物已就绪（非草案、关键事实非 `MISSING`）：

| 开发环节 | 控制资产 | 前置依赖 |
|---|---|---|
| 需求进入 | `prd-docs`（产品/业务需求入口与最终事实源）、pm-skills 方法论辅助（`deliver-prd`/`deliver-user-stories`/`deliver-acceptance-criteria`/`deliver-edge-cases`）、`knowledge-search` | 源料/知识源 |
| Spec 契约（可选） | OpenSpec（`propose`→`apply`→`archive`） | 需求 |
| 架构设计 | `architecture-docs` | 需求 |
| 架构改进 | `architecture-deepening`、`architecture-refactor`、`architecture-docs` | 架构设计、代码现状可访问；`architecture-refactor` 仅在用户确认具体 DC-* 后执行 |
| API/组件契约 | `api-docs`、`components-docs` | 需求、架构 |
| 测试设计 | `test-docs` | 需求、API/组件契约 |
| 实现计划 | `frontend-impl-plan`、`backend-impl-plan` | 需求、API/组件契约、测试设计 |
| 实现编码 | 规则层、TDD/调试类 skills | 实现计划 |
| 调试修复 | `systematic-debugging`、`retrospective-correction` | bugfix 复现现象 / 实现编码后偏差或回归现象 |
| 代码评审 | `code-reviewer`、`requesting-code-review` | 实现编码 |
| 测试验证 | `verification-before-completion` | 实现编码、代码评审 |
| 提交 PR | `github-pr-workflow`、`pr-creator` | 代码评审、测试验证 |

链式前置门禁：进入下游环节前必须确认上游产物存在且已就绪；上游缺失或仍为草案时，下游报告 `MISSING blocked` 并停止，不得臆造上游事实继续推进。`scripts/verify-stage-gate.mjs` 对消费方项目做该校验。

产品/业务需求入口以 `prd-docs` 为准；pm-skills 仅作为需求发现、用户故事、验收标准和边界用例的方法论辅助，辅助产出必须归一化进 `docs/prds/` 后才能作为下游事实源。

关键环节子代理调度：规则层必须写明「什么时候调用什么子代理」，覆盖多源调研、实现计划、实现编码、调试修复、代码评审、测试验证、文档可控性校验、规则自足性校验和架构深化/重构。调度索引必须点名 `debugger`、`frontend-planner`、`backend-planner`、`frontend-coder`、`backend-coder`、`frontend-reviewer`、`backend-reviewer`、`architecture-refactor`，并说明自包含、复核、不同实例、隔离、并行、独立性。调度规则区分 `skill` 与 `subagent`：skill 承载知识内容与方法论，subagent 承载上下文隔离、并行和反自评边界；宿主不支持同名 agent 时，按同等职责与隔离边界选择可用子代理。多源调研可使用临时研究子代理或宿主 explorer 能力；测试验证可由主代理直接执行，或在输出量大、耗时长、跨多模块时派临时验证子代理加载 `verification-before-completion`；文档可控性校验与规则自足性校验使用临时 clean/headless validator。这些临时子代理不是固定 `agents/` 文件。

headless / 干净隔离用于三类后置校验，但输入与闭环不同：

- 文档可控性校验：输入为规则、被校验的 PRD/测试设计/实现计划等文档产物和必要 rubric，检查产物是否自足、结构完整、`MISSING` 标记完整；缺口回填产物或上游 skill 后复测。
- 规则自足性校验：输入为规则、目标投影产物（`rules/AGENTS.md`、`rules/sources/*.md`、根 `AGENTS.md`/`CLAUDE.md` 或 init-project reference）和必要 rubric，检查规则脱离主会话是否仍能独立表达触发条件、门禁、状态语义与禁止替代通过；缺口回填规则源或投影产物后复测。确定性入口为 `npm run verify:rules:self-sufficiency`，L2 聚合门禁必须包含它；需要 live clean 子代理复审时仍按本节要求单独记录结论。
- skill 纯净测试：输入为 init-project `references/` 规则、被测 skill 和最小任务，检查 skill 自身是否能驱动干净 agent 产出合规产物；缺口回填 skill 后复测。

干净隔离指无主会话历史、无宿主 AGENTS/baseline、无额外引导；可使用只读工具、文件系统快照和显式注入的必要规则/产物/rubric。无法提供干净隔离时标记 `MISSING` 或 `NOT RUN` 并说明原因，不得用非干净执行替代通过。

## 质量门禁

交付前的检查按风险分级执行，状态统一使用 `PASS`、`FAIL`、`MISSING`、`NOT RUN`、`N/A`，不得把失败、缺失、不相关或未运行转写成通过：

- AIRules 自身：PR 阶段 `ci.yml` 跑 `lint:check`、`typecheck`、`test`、`rules:check`、`delivery:verify`、`verify:rules:self-sufficiency`、`verify:skills`、`verify:knowledge-sources`；本地 `pre-commit` 跑 lint-staged，`pre-push` 跑 `typecheck` + `verify:skills`；发布阶段 `publish.yml` 再跑同等控制门禁并校验 tag 版本。
- 下游消费方：按环节控制矩阵执行对应校验，任一门禁失败不得声明可交付。
- 规则基线漂移防护：`rules/AGENTS.md` 为 `rules/sources/*.md` 的拼接产物，`npm run rules:check` 校验产物与源一致。
