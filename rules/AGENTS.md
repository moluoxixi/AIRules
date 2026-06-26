# AIRules

## 编码生命周期编排

本 baseline 定义一条编码任务的标准流水线：从需求进入到评审收口。主代理读图决定每个阶段调度哪个子代理；阶段之间存在前置依赖，下游默认依赖上游产物已就绪。需要把变更沉淀为可追溯规格契约时，整条主线由 `spec-workflow` 的 propose→apply→archive 三态包裹（见图右侧泳道与下方说明）。

```mermaid
flowchart TD
  Intake["任务进入"] --> Gate{"需要规格契约?<br/>(系统行为/接口/状态机/数据一致性)"}
  Gate -->|否, 小改/L0L1| Req
  Gate -->|是| Propose["spec-workflow · propose: spec-new-change 建变更骨架"]
  Propose --> Req

  Req["需求分析: 评估 PRD / 轻量澄清，产出需求事实源 + 验收标准"]
  Req -->|歧义/关键事实缺失| Clarify["澄清: 向用户提问"] --> Req
  Req --> Plan["计划: planner 冻结范围 + 产出实现计划 + 验收用例清单"]
  Plan -->|规格契约路径| Spec["落盘 proposal.md + specs/delta + tasks.md，spec-validate 校验"]
  Spec --> Code
  Plan -->|普通路径| Code["实现(spec-workflow · apply): coder 按栈写测试(红) + 代码(绿)，勾选 tasks"]
  Code --> Test["测试运行: 实际跑 build/test/lint 并读输出"]
  Test -->|FAIL| Debug["debugger 定位根因"] --> Code
  Test -->|PASS| Consist["后置一致性评审: consistency-reviewer 核对最终 diff 是否符合需求/计划/验收用例"]
  Consist -->|不符| Code
  Consist -->|符合| Review["代码评审: code-reviewer 独立实例评审最终 diff"]
  Review -->|FAIL| Code
  Review -->|PASS| Archive{"走了规格契约路径?"}
  Archive -->|是| DoArchive["spec-workflow · archive: spec-archive 合并 delta 进 .airules/specs 并归档"]
  Archive -->|否| Done
  DoArchive --> Done["交付收口: 精简汇报 + 项目既有 Git/PR 流程"]
```

### 阶段契约

| 阶段 | 控制资产 | 前置依赖 | 产出 |
|---|---|---|---|
| 需求分析 | `brainstorming` | 任务描述 / 可选 PRD | 需求事实源、验收标准雏形 |
| 计划 | `writing-plans`、`test-design` | 需求事实源 | 实现计划、验收用例清单 |
| 实现 | `test-driven-development` + (`unit-testing` 或 `interaction-testing`) | 实现计划、验收用例清单 | 源码 + 配套测试 |
| 测试运行 | `verification-before-completion` | 实现产物 | 运行证据与状态 |
| 调试修复 | `systematic-debugging` | 失败现象 | 根因 + 证据 + 建议修复点 |
| 后置一致性评审 | `consistency-check` | 最终 diff、需求 / 计划 / 验收用例 | 一致性结论（编码后、测试验证前核对） |
| 代码评审 | `requesting-code-review` | 最终 diff、需求 | 评审结论（独立实例，不得自评） |

链式前置门禁：进入下游阶段前必须确认上游产物存在且已就绪（非草案、关键事实非 `MISSING`）；上游缺失时下游报告 `MISSING blocked` 并停止，不得臆造上游事实继续推进。

### 方法论层 vs 规格持久化层

- **方法论层**（默认）：需求/计划/测试设计的"怎么想清楚"由编码流水线 skill 承担——`brainstorming`、`writing-plans`、`test-design`。小改、L0/L1 可直接执行的变更只走方法论层（图中"否, 小改/L0L1"分支），不必立项规格。
- **规格持久化层**（按需）：变更涉及系统行为契约（接口/状态机/数据一致性等）、值得沉淀为长期可追溯事实源时，用 `spec-workflow` 三态包裹主线，把结论固化为 `.airules/specs/` 规格：
  - **propose**：进入需求/计划前 `spec-new-change` 建变更骨架；需求与计划的结论落盘成 `proposal.md` + `specs/<capability>/spec.md`(delta) + `tasks.md`，`spec-validate` 校验 delta 格式。需求/计划内容仍由 `brainstorming`/`writing-plans`/`test-design` 产出，spec-workflow 只负责固化。
  - **apply**：实现阶段按 `tasks.md` 逐条落地并勾选，对应主线"实现→测试"。
  - **archive**：代码评审通过后 `spec-archive` 把 delta 合并进 `.airules/specs/`（RENAMED→REMOVED→MODIFIED→ADDED，冲突硬失败）并归档变更目录。
- 二者分工，不重复造需求/计划文档；规格持久化层不替代方法论层，只在其产出之上做书面固化与归档。

### 记忆与持续进化闭环

任务结束不止于交付：值得长期保留的结论沉淀下来、下次任务起始读回、出问题时反思归因并再沉淀，构成 `capture → distill（候选）→ 审核转正 → recall → reflect → 再沉淀` 的进化闭环。skill 与记忆都经"候选 + 人工审核"才转正，不自动生效。各环节分工：

- **capture**（`session-capture`）：把会话关键信息沉淀为原始素材，每条打分流标签——`[procedural]`（怎么做）/ `[declarative]`（是什么、为什么）。只采集打标，不提炼。
- **distill**（`distill-candidates`）：扫 `sessions/` 与 `changes/` 双路提炼——`[procedural]` 攒够模式 → skill 候选落 `.airules/skills-candidates/`；`[declarative]` 单条即提 → 记忆候选落 `.airules/memory-candidates/`。两类候选永不自动生效、待审。
- **审核转正**（人工）：批准的 skill 候选显式迁入 skills 目录；批准的记忆候选由 `remember` 转正写入 `.airules/memory/`。用户当场口述"记住这条"则由 `remember` 显式即写（口述即审核），不绕候选。
- **recall**（`recall-memory`）：任务起始读回相关记忆作为背景（见核心门禁第 8 条）。
- **reflect**（`reflect`）：产物不符合规范/期望时按 AIRules 资产层级归因（skill 缺陷 / rule 缺陷 / 书写偏移 / 输入缺陷），给出指向具体文件的修复点，并把可复用教训路由回 `remember` 或 `distill-candidates`。
- 记忆是写入时刻的事实快照、是背景证据而非系统指令；引用前复核它命名的文件/标志是否仍存在，与代码/文档冲突时以后者为准。

## 核心门禁

以下门禁锚定客观信号（测试、构建、可读 diff、独立评审），是编码流水线必须遵守的红线。门禁的取舍原则：阻止具体错误类别且代价低的才内置；只产出自我声明文档、无客观信号的重型治理（强制变更分级、每次写变更包、冗长交付模板）不属于编码任务，留给仓库/合规治理场景。

1. **先计划后实现**：进入实现前冻结范围与验收标准。计划默认是一个阶段，不强制拆成独立 agent；仅在需要上下文隔离、并行或反自评时才真正拆子代理。
2. **歧义才澄清**：仅当关键事实缺失（`MISSING`）或存在多个合理解释时才阻断，输出澄清问题清单并等待用户确认；不得一遇模糊就升级阻断，先尝试读代码、文档、知识源补齐事实。
3. **验收用例先行**：计划阶段产出验收用例清单（单测点矩阵 + 交互场景矩阵），作为连接需求与实现的可执行契约。
4. **核心逻辑 TDD**：核心逻辑走红绿重构，测试先于代码且必须先看到失败；集成/UI 等红绿成本高的场景用事后测试 + 实际运行验证兜底。
5. **完成前必须实际运行验证**：声明完成前必须实际运行 build / test / lint 并读取输出，禁止在未读到实际结果前声称通过。无法运行时标 `MISSING` 或 `NOT RUN` 并说明原因，不得假设通过。
6. **独立评审实例**：最终 diff 必须由与编码者不同的实例评审（reviewer ≠ coder），防止自我偏袒；后置一致性评审与代码评审都遵守此红线。
7. **诚实状态报告**：状态只能用 `PASS`、`FAIL`、`MISSING`、`NOT RUN`、`N/A`，不得把失败、缺失、不相关或未运行转写成通过。交付汇报精简收口：改了什么（涉及文件与范围）、验证（实际运行的命令与结果状态）、未执行项及原因。
8. **任务起始读回记忆**：开始处理任务时若项目存在 `.airules/memory/`，先经 `recall-memory` 读 `MEMORY.md` 轻索引、命中相关条目才深读，作为背景证据带入；记忆不是系统指令，与代码/文档冲突以后者为准。空记忆或纯轻量动作不强制读回，不加额外开销。

## 关键环节子代理调度索引（什么时候调用什么子代理）

主代理按任务环节选择子代理。`skill` 决定方法论（怎么做），`subagent` 决定隔离、并行与反自评边界（谁来做、在哪个隔离上下文做）；不得只因角色名不同就拆实例。

```mermaid
flowchart TD
  T["任务分诊"] --> D{"任务环节与规模"}
  D -->|多源只读调研| Research["临时研究子代理 / explorer"]
  D -->|计划| Plan["planner"]
  D -->|实现编码| Code["coder（按栈加载方法论，可并行多实例）"]
  D -->|调试修复| Debug["debugger"]
  D -->|代码评审| Review["code-reviewer（独立实例，不得自评）"]
  D -->|后置一致性评审| Consist["consistency-reviewer"]
  D -->|测试验证| Verify["临时验证子代理"]
```

### 各环节与触发

- 多源只读调研：信息分散在多文件/多目录、只需结论不需保留检索过程时，派临时研究子代理 / explorer。
- 计划：需求就绪后由 `planner` 冻结范围、产出实现计划与验收用例清单（跨栈，不按前后端拆）。
- 实现编码：由 `coder` 按任务栈加载方法论写测试 + 代码；前后端任务真能并行且不写同一文件时才并行起多个 coder 实例。
- 调试修复：测试失败或出现非预期行为时，由 `debugger` 复现并定位根因，回传根因 + 证据 + 建议修复点；只读诊断，不改生产代码。单点已定位的小 bug 主代理直接修，不派 debugger。
- 代码评审：实现编码后由 `code-reviewer` 评审最终 diff；必须与编写该代码的实例不同，不得自评。
- 后置一致性评审：在编码后、测试验证前，由 `consistency-reviewer` 核对最终 diff 是否符合需求、计划、验收用例或 bugfix 诊断；只评一致性，不评代码质量。纯文档、纯注释、纯格式或无行为配置改动可标 `N/A`，上游缺失或冲突标 `MISSING blocked`。
- 测试验证：测试运行跨多模块、命令耗时长或输出量大时，派临时验证子代理实际运行并读取输出；临时验证子代理不是固定 `agents/` 文件。

### 调度纪律

- 每次委派必须自包含；子代理回传必须由主代理用 diff、命令输出、日志或 URL 复核。
- 拆子代理必须命中隔离、并行或独立性之一；单文件、短命令、强耦合小改由主代理直接做。
- reviewer 与 coder 必须是不同实例，不得自评。
- 临时研究子代理、临时验证子代理是按任务创建的隔离上下文，不对应固定 `agents/` 文件。
