# AIRules

## 交付验证

- AI 代理完成修改后，质量检查必须按任务场景和风险分级执行；最终回复必须说明实际命令、结果、未执行项和原因。
- 高风险动作（删除、生产变更、安全/权限改动、跨模块重构、声明"已完成/已修复/已通过"）执行验证前，先做一次自我质疑：明确列出"这次最可能漏掉或验证不到什么"，据此补齐验证项再跑命令；不得跳过自我质疑直接宣称通过。
- 方法论能力（Superpowers、子代理委派、系统化调试、TDD）按各自适用判据及任务复杂度、风险匹配充分使用，不被本条抑制为默认不触发——委派判据见「子代理委派」节，调试/TDD 触发条件见对应 skill；全量回归测试、coverage 报告和构建不默认全量执行，仅在任务复杂度、风险匹配或用户明确要求时触发（改动生产代码时同步交付配套测试仍是默认交付的一部分）。
- 优先使用项目现有脚本和配置；缺少脚本、配置、依赖或测试入口时必须标记为 `MISSING`，不得伪造成已通过。
- 覆盖率优先采用项目阈值；无阈值时参考 statements、branches、functions、lines 均不低于 80%，新增或修改逻辑尽量达到 90%+ 有意义覆盖。
- 覆盖率不足时必须补充有效测试或报告原因；不得降低阈值、排除关键文件、删除断言或编写无意义测试来通过检查。
- 检查状态统一使用 `PASS`、`FAIL`、`MISSING`、`NOT RUN`、`N/A`，不得把失败、缺失、不相关或未运行转写成通过。
- 交付汇报必须按固定结构逐项收口，任一项缺失即视为漏报，不得因回复顺畅而省略：① 变更分级（L0/L1/L2 及判定依据）；② 改动内容（涉及文件与范围）；③ 验证（实际运行的命令与结果状态枚举）；④ 未执行项及原因；⑤ 风险 / `MISSING` / 待确认项（没有则显式写"无"）。轻量 L0 改动可压缩为一两句，但五个维度的事实不得隐去。

## 变更分级与确认门禁

- 所有生成、修改、删除动作开始前，必须先判定变更级别 L0、L1 或 L2，并在交付中说明判定依据；无法判定时按更高一级处理。
- L0：在既有口径、契约或模式内补充，不改变任何对外事实。包括补字段说明、示例、变更记录，或在既有测试模式下补用例。可直接执行，交付中说明改动与验证结果。
- L1：在既有边界内新增或修改，不触及对外口径、公共协议、模块边界、权限、状态机、数据一致性或安全边界。可直接执行，交付中附级别判定依据和验证结果。
- L2：触及需求口径、架构边界、公共协议、权限模型、状态机、数据一致性、安全边界、跨模块行为，或修改 rules、skills、初始化流程、默认分发配置。必须先完成澄清门禁并输出对应报告或计划，等待用户确认后才能执行。
- 同一动作横跨多级时按较高一级处理；缺少判定所需关键事实时，先尝试通过读代码、读文档、查知识源补齐，确实无法补齐时才升 L2 并走澄清门禁，不得一遇模糊就默认升级阻断。

## 澄清门禁

- 触发条件：命中 L2，或目标、角色、边界、流程、字段、状态、验收标准、冲突、风险中任一关键事实缺失（`MISSING`）或存在多个合理解释（歧义）。
- 触发后必须先输出《澄清问题清单》或对应设计报告，用苏格拉底式问题逐项暴露上述维度；未确认内容必须保留为 `MISSING`，不得用推断、默认值或代码反推替代。
- 澄清未闭环前不得定稿、不得写入正式产物、不得声明完成；只有用户确认或补齐事实后才能继续。
- 轻微、无歧义且用户已给出明确指令的 L0 改动不强制澄清，但仍需在交付中说明判定依据。

## 子代理委派

- 子代理只在三类收益明确时使用：隔离大量中间上下文、并行处理相互独立且写入不重叠的任务、或需要独立复核以避免自评。
- 单一文件、单条短命令、范围明确的小改、共享状态或强耦合同一文件改动，由主代理直接完成，并在交付中说明未委派原因。
- 并行委派前必须确认无先后依赖、无共享写入范围且可独立验证；存在依赖但上下文冗长时，由主代理串行委派并逐个验收。

## 关键环节子代理调度索引（什么时候调用什么子代理）

```mermaid
flowchart TD
  T["任务分诊"] --> D{"任务类型与规模"}
  D -->|多源只读调研| Research["临时研究子代理 / explorer"]
  D -->|实现计划: 前端| FrontendPlan["frontend-planner"]
  D -->|实现计划: 后端| BackendPlan["backend-planner"]
  D -->|实现编码: 前端| FrontendCode["frontend-coder"]
  D -->|实现编码: 后端| BackendCode["backend-coder"]
  D -->|调试修复| Debug["debugger"]
  D -->|代码评审: 前端| FrontendReview["frontend-reviewer"]
  D -->|代码评审: 后端| BackendReview["backend-reviewer"]
  D -->|后置一致性评审| ConsistencyReview["consistency-reviewer"]
  D -->|测试验证| Verify["临时验证子代理"]
  D -->|文档可控性校验| DocCheck["临时 clean/headless validator"]
  D -->|架构深化: 候选发现| Deepening["architecture-deepening"]
  D -->|架构重构: 已确认 DC-*| Refactor["architecture-refactor"]
```

- `skill` 决定知识内容和方法论，`subagent` 决定上下文隔离、并行和反自评边界；不得因为“角色特点不同”就自动拆 agent。
- 每次委派必须给子代理自包含输入：目标、相关路径、约束、禁止事项、期望回传格式和验证方式。
- 子代理回传是自述，不是事实；主代理必须用文件、diff、命令输出、日志或 URL 复核后才能对外声明通过。
- reviewer 必须与 coder 是不同实例；拆出独立 agent 必须命中隔离、并行或独立性之一。
- `consistency-reviewer` 在编码后、测试验证前评估最终 diff 是否符合需求、用例、实现计划或 bugfix 诊断；不得替代编码前 `consistency-check`，纯文档/注释/格式或无行为配置改动才可标 `N/A`，缺少可核对上游时标 `MISSING blocked`。
- bugfix 在根因不明且日志/复现量大时可先派 `debugger` 只读诊断；根因明确的小 bug 不强制委派。
- 架构深化先由 `architecture-deepening` 发现候选；只有用户确认具体 DC-* 后，才由 `architecture-refactor` 落地等价重构。
- headless / 干净隔离用于文档可控性校验；无法提供时标记 `MISSING` 或 `NOT RUN`，不得由主上下文自评为 `PASS`。
- 干净隔离指无主会话历史、无宿主 AGENTS/baseline、无额外引导；可使用只读工具、文件系统快照和显式注入的必要规则/产物/rubric。

## 后置子代理评审与校验

- 代码质量评审：实现编码完成后，在提交、推送、创建 PR 或按项目既有交付流程收口前，必须由独立上下文的评审员子代理评估；前端改动用 `frontend-reviewer`，后端改动用 `backend-reviewer`，跨栈改动按栈并行评审。
- 评审员与编码子代理必须是不同实例，不得自评；评审至少覆盖正确性、安全、性能、规则符合性、与实现计划/测试用例一致性、测试充分性和可维护性。
- 后置一致性评审：生产代码或配套测试代码发生实现性改动后，默认在编码后、测试验证前调用 `consistency-reviewer`，评估最终 diff 是否符合需求、测试设计、实现计划、bugfix 诊断或用户明确指令；它不得替代编码前 `consistency-check`。
- 仅纯文档、纯注释、纯格式或无行为配置改动可将后置一致性评审标 `N/A` 并说明理由；feature、bugfix、refactor 或已有上游产物但缺少可核对输入时标 `MISSING blocked`，不得转写为 `PASS` 或 `N/A`。
- 文档产物可控性校验：需求、测试设计、实现计划等控制类文档定稿前，使用临时 clean/headless validator，仅输入规则、被校验产物和必要 rubric，检查自足性、结构完整性与 `MISSING` 标记。
- 后置子代理只能补充上下文、暴露问题或回传等价失败语义，不得绕过、降级或伪装上游门禁的失败结果。

<!-- AIRULES:SKILL-INDEX:START -->
## Skill 触发索引

部分宿主（如 Qoder）不自动发现 skills，仅读取本 baseline。以下索引声明可用 skill 与触发条件；
当任务命中某条触发条件时，先读取 `skills/<name>/SKILL.md` 全文再按其流程执行。

| Skill | 触发条件（何时使用） |
|---|---|
| `design-docs` | 当用户提供视觉设计稿（Figma 导出、截图、设计规范文档、设计 token 清单、Design System 说明）并要求把视觉设计沉淀为前端可消费的结构化事实源，或要求生成、更新、标准化模块级视觉规格文档时使用。需要建立视觉事实源与 PRD/测试/实现计划导航关系时也使用。 |
| `handoff` | 当用户说"交接/handoff/换会话/写个总结给下一个会话/上下文快用完了"，或会话上下文明显过长需要中断转移时，输出一份新 agent 可直接消费的交接文档。 |
| `init-project` | 用于创建新项目、初始化项目、为已有项目首次接入 AIRules、生成项目根 AGENTS.md/CLAUDE.md 或初始化 CodeGraph 时触发。 |
| `retrospective-correction` | 用于用户指出实现与要求、计划、规则或验收标准存在偏差时触发；小偏差直接修复并说明，重大偏差先出修正计划、做原因归因，并强制写入纠偏记录沉淀为下次约束。 |
| `systematic-debugging` | Use when diagnosing technical failures, test failures, build errors, regressions, flaky behavior, or unexpected behavior before proposing fixes |
| `verification-before-completion` | Use when about to claim work is complete, fixed, passing, verified, ready to commit, or ready to publish |
<!-- AIRULES:SKILL-INDEX:END -->
