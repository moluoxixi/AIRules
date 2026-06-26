# 编码生命周期编排 — 重写设计方案

## 背景与定位

- 仓库 `AIRules` 是「元项目」：产物（rules/skills/agents）是给下游 AI 编码代理读的纯数据。
- 最近提交「移除错误 skills,agents，重写」已清空 `agents/`、`rules/sources/`，`skills/` 仅剩 `handoff`。本次是**完全重写编排内容**，保留分发引擎（`constants/`、`scripts/lib/`、vendor 投影、host 映射、CLI 不动）。
- 目标：一条编码生命周期流水线 `需求分析 → 计划(含验收用例) → 实现(TDD+测试) → 测试运行 → 评审(一致性+代码)`，以**全局 rules 编排图**形态存在，主代理读图调度子代理。

## 已确认决策

1. 产物边界：只重做 编排(rules) + skills + agents；分发引擎不动。
2. 落地形态：全局 rules 编排图（写进 `rules/AGENTS.md`，由 `rules/sources/*.md` 拼接生成）。
3. 治理复杂度：**按最佳实践降级**。编码流水线只内置锚定客观信号的核心门禁；L0/L1/L2 判级、变更包、headless 自足校验等重型治理属仓库维护语义，不强加给下游编码任务。
4. 架构环节：不纳入。主线仅 需求→计划→实现→测试→评审。
5. 需求入口：`requirements-analysis` 自适应——有 PRD 消费之，没有则轻量澄清并产出需求事实源。
6. 分栈：经研究修正——不按前后端硬拆 agent（领域差异≠隔离/并行需求）。coder/reviewer 各一个固定 agent，按任务栈加载对应方法论 skill；前后端真能并行且不写同一文件时才并行起多个 coder 实例。

## 研究结论支撑（业界最佳实践）

- 收益最高门禁：完成前必须实际运行验证、独立 reviewer 实例（防自偏好偏置，有论文+SWE-bench 实证）、plan-then-act、歧义先澄清、诚实状态报告。
- 过度工程（编码场景）：强制变更分级、每次写变更包、每次 headless 校验、冗长交付模板——这些是仓库/合规治理语义。
- 分工共识：skill 决定方法论，subagent 决定隔离/并行/反自评边界；不要只因角色名不同拆实例。planner/coder 拆独立实例对强耦合顺序任务常退化，plan 宜作阶段而非强制独立 agent；独立 reviewer 是最稳拆分。
- 测试定位：计划阶段产出验收用例清单（spec 契约）+ 实现阶段核心逻辑 TDD 红绿 + 集成/UI 事后测试，三者组合。

## 7 条核心门禁（写进 rules 红线）

1. Plan-as-phase：进实现前冻结范围 + 验收标准。
2. 需求歧义才澄清：仅关键事实缺失或多解时阻断并出问题清单；不滥用阻断。
3. 计划阶段产出验收用例清单（连接需求与实现的可执行契约）。
4. 核心逻辑 TDD 红绿，其余事后测试。
5. 完成前必须实际运行 build/test/lint 并读取输出，禁止未读输出就声明完成。
6. 独立 reviewer 实例复核最终 diff，reviewer ≠ coder。
7. 诚实状态枚举：PASS / FAIL / NOT RUN / N/A 不可混淆。

## 产物清单

### 固定 agents（agents/*.md，承载隔离/反自评/并行）

| agent | 阶段 | 加载 skill | 写入边界 |
|---|---|---|---|
| `planner` | 计划（跨栈） | `impl-plan`、`test-design` | 只写计划与验收用例文档 |
| `coder` | 实现（按栈加载方法论，可并行多实例） | `tdd` + (`unit-testing` 或 `interaction-testing`) | 源码 + 配套测试 |
| `code-reviewer` | 代码评审（独立实例，按栈加载 rubric） | `code-review` | 只读评审，不改代码 |
| `consistency-reviewer` | 后置一致性评审（编码后、测试前，跨栈） | `consistency-check` | 只读评审，可写 `docs/consistency/*.md` |
| `debugger` | 调试根因（跨栈，只读诊断） | `systematic-debugging` | 只读诊断 + 可落盘诊断文档，不改生产代码 |

临时子代理（不落固定文件）：researcher/explorer（多源调研）、verifier（测试运行）、clean validator（文档可控性，可选）。

### skills（skills/*/SKILL.md，承载方法论）

| skill | description | 职责 |
|---|---|---|
| `requirements-analysis` | 有 | 自适应：消费 PRD 或轻量澄清，产出需求事实源 + 验收标准雏形 |
| `impl-plan` | 有 | 实现计划方法论，含可追溯字段（需求来源/接口/组件/数据模型/契约来源） |
| `test-design` | 有 | 测试用例先行：单测点矩阵 + 交互场景矩阵 |
| `tdd` | 有 | 红绿重构，测试先于代码 |
| `unit-testing` | 有 | 后端/纯逻辑单测方法论（边界/异常/分支/mock 隔离） |
| `interaction-testing` | 有 | 前端交互测试方法论（组件交互/表单/状态/空错态/E2E） |
| `verification` | 有 | 完成前验证：运行命令、读输出、状态收口 |
| `code-review` | 无（具名加载） | 代码评审 rubric |
| `consistency-check` | 无（具名加载） | 需求符合度核对 rubric |
| `systematic-debugging` | 无（具名加载） | 根因定位四阶段方法论 |

> description 有/无的依据：希望主代理自动捞起的写 description；只由具名 agent 加载的省略，避免污染主上下文（符合 verify-skill-frontmatter.mjs 规则）。

## rules 编排图结构（rules/sources/*.md → rules/AGENTS.md）

分节源文件，`assemble-baseline.mjs` 按文件名排序拼接：

- `00-overview.md`：编排主线 Mermaid 图（需求→计划→实现→测试→评审，含失败回环）。
- `10-core-gates.md`：7 条核心门禁红线。
- `20-subagent-dispatch.md`：子代理调度索引 Mermaid 图（任务分诊→按类型派 planner/coder/code-reviewer/consistency-reviewer/debugger + 临时研究/验证子代理），含 skill/subagent 边界说明、reviewer≠coder、自包含、复核要求。
- `30-status-reporting.md`：状态枚举与精简交付汇报（改了什么 + 验证命令与结果 + 未做项）。

## 需要同步重写的校验断言（保留脚本机制，改内容）

旧脚本把旧编排节点名/agent名写死，必须改为匹配新编排，否则门禁必挂：

- `scripts/verify-delivery-control.mjs`：
  - `REQUIRED_SUBAGENT_DISPATCH_*`：去掉 frontend/backend-planner、frontend/backend-coder/reviewer、architecture-* 等旧名，改为新 5 agent 名 + 新调度图节点/边 patterns。
  - `REQUIRED_DELIVERY_VERIFICATION_*` / `REQUIRED_CHANGE_LEVEL_*`：按降级后的精简治理调整（移除强制变更分级图断言或降为可选）。
  - `checkAgentLayer`：从校验 `consistency-reviewer.md` 扩展/调整为新 agent 集合。
  - `checkRuleLayer`：错误暴露契约位置调整（原在 init-project/code-core.md，本次不纳入 init-project，改为放 rules 红线或 verification skill）。
- `scripts/verify-skill-frontmatter.mjs`：
  - `FRONTEND_IMPL_PLAN_REQUIRED_ITEMS` / `BACKEND_IMPL_PLAN_REQUIRED_ITEMS` 专项断言 → 改为对 `impl-plan` 的统一可追溯字段断言。
- `docs/delivery/control-contract.md`：更新「环节控制矩阵」「子代理调度点名清单」为新编排。

## 校验脚本重写规格（改写唯一事实源）

新 baseline 三节标题（assemble 后出现在 rules/AGENTS.md，每节带 `# AIRules` 头）：
- `## 编码生命周期编排`（00-overview）
- `## 核心门禁`（10-core-gates）
- `## 关键环节子代理调度索引（什么时候调用什么子代理）`（20-subagent-dispatch）

调度图规格（脚本断言锚点，节点名/边必须一致）：
- 标题：`关键环节子代理调度索引（什么时候调用什么子代理）`
- mermaid `flowchart TD`，节点：`T["任务分诊"] --> D{...}`；边 `D -->|多源只读调研| Research`、`D -->|计划| Plan["planner"]`、`D -->|实现编码| Code["coder..."]`、`D -->|调试修复| Debug["debugger"]`、`D -->|代码评审| Review["code-reviewer..."]`、`D -->|后置一致性评审| Consist["consistency-reviewer"]`、`D -->|测试验证| Verify["临时验证子代理"]`
- 必含 token：`skill`、`subagent`、`planner`、`coder`、`code-reviewer`、`consistency-reviewer`、`debugger`、`临时研究子代理`、`临时验证子代理`、`自包含`、`复核`、`不同实例`、`隔离`、`并行`、`独立性`、`MISSING blocked`、`编码后`、`测试验证前`

### verify-skill-frontmatter.mjs
- 删 `FRONTEND_IMPL_PLAN_REQUIRED_ITEMS` / `BACKEND_IMPL_PLAN_REQUIRED_ITEMS` 及对应 checker。
- 新增 `impl-plan` 统一可追溯字段断言：name==='impl-plan' 时正文必须含 `需求来源`、`契约来源`，且至少含后端字段组(`接口设计`/`数据模型`/`代码分层与职责`/`事务与一致性`)与前端字段组(`调用接口`/`使用/封装组件`/`类型（使用/封装）`)的标识。
- 保留：行数≤500、四段式、description trigger、示例边界、占位符、`<AIRules>/scripts` 检查。

### verify-delivery-control.mjs
- 调度断言常量换为上述 5-agent 规格；删 `REQUIRED_DELIVERY_VERIFICATION_*`、`REQUIRED_CHANGE_LEVEL_*` 两套图断言与 `hasDeliveryContract`/`hasGradingContract` 检查。
- checkRuleLayer：仅校验存在编排主线节(`## 编码生命周期编排`)、核心门禁节(`## 核心门禁`)、调度索引节(三项)。错误暴露契约改为校验 `rules/AGENTS.md` 含「实际运行」「不得伪装」类门禁文本，不再指向 init-project/code-core.md。
- 保留：skill 层、checkAgentLayer(consistency-reviewer)、checkExecutionLayer(package files/scripts 接线)、checkDeliveryContract(存在性+调度声明)。
- checkProjectReference：当前仓库未携带 init-project skill，走 `n/a` 分支，保持不变。

### verify-rule-self-sufficiency.mjs
- `DISPATCH_ITEMS` 换 5-agent 规格；删与重型治理绑定项(`文档可控性校验`/`架构深化`/`architecture-*`/`clean/headless validator`)。
- 删 `HEADLESS_ITEMS` 强制段与 `checkDispatchSection` 的 headless 校验；source 文件指向改为 `rules/sources/20-subagent-dispatch.md`。
- 保留：根 `AGENTS.md`==`CLAUDE.md` 投影一致、层级边界 token、拼写检查、`<AIRules>/scripts` 检查。
- control-contract 断言 token 按新契约调整。

### verify-change-packs.mjs
- 不动（与编排正交，纯校验变更包目录结构）。

### 配套测试同步
- `tests/delivery-control.test.ts`、`tests/rule-self-sufficiency.test.ts`、`tests/skill-frontmatter-script.test.ts` 按上述规格重写 fixture 与断言。
- `tests/change-packs.test.ts`、`tests/init-project-scripts.test.ts`、`tests/vendors.test.ts` 不动（正交）。

## 不动清单

- `constants/hosts.ts`、`constants/skills.ts`、`scripts/lib/**`（投影/安装/vendor）、CLI、host 映射。
- `package.json` 的 scripts 键名（verify:* 命令名保持，便于 CI 复用）。

## 实施步骤

1. 建 `rules/sources/` 4 个分节源文件 → `npm run rules:build` 生成 `rules/AGENTS.md`。
2. 建 5 个 `agents/*.md`。
3. 建 10 个 `skills/*/SKILL.md`。
4. 重写 `verify-delivery-control.mjs` 与 `verify-skill-frontmatter.mjs` 断言常量。
5. 更新 `docs/delivery/control-contract.md`。
6. 验证：`rules:check` → `delivery:verify` → `verify:skills` → 逐 skill `verify-skill-frontmatter.mjs`；新 skill 跑 `purity-check`。
7. 因本次改 rules/skills/agents/分发配置，对 AIRules 仓库自身属 L2，建一个 L2 变更包 `docs/changes/<id>/` 记录（这是仓库维护治理，不是下游编码门禁）。

## 已定决策（原待确认项收口）

- 校验脚本按新编排**完全重写**，旧的重型治理断言（变更分级图、headless 自足性、变更包结构等）一并清除；脚本只校验编码流水线相关资产（5 agent、新调度图、7 条门禁、impl-plan 可追溯字段）。不拆两套。
- `requirements-analysis` 仅产出需求事实源（含验收标准雏形）供下游消费；有 PRD 则消费，无则轻量澄清产出。不强制写盘 `docs/prds/`。
