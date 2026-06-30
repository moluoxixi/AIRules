# ADR-0003 收敛为 5-agent + 按需多实例

## 状态

accepted

## 背景

[ADR-0002](./ADR-0002-skill-agent-layering.md) 确立了 skill（方法论）/ agent（隔离执行角色）两层解耦，并落地了一套「分栈 9-agent」集合：debugger、frontend-planner、backend-planner、frontend-coder、backend-coder、frontend-reviewer、backend-reviewer、consistency-reviewer、architecture-refactor。

实践中这套集合暴露两个问题：

- **角色数量与可靠性脱钩**。MetaGPT、ChatDev 把软件工程 SOP 编码为多智能体流程，但同时提醒：多 agent 的收益来自中间产物、检查点和失败回退，而不是角色数量本身。SWE-agent 进一步指出 agent 的软件工程能力上限由 agent-computer interface（读 diff、读测试输出、读日志、独立评审）决定，而非按栈预拆角色。
- **前后端硬拆带来维护负担**。frontend/backend 两套 planner/coder/reviewer 让同一方法论分散在多个 agent 文件，方法论更新要改多处；而栈差异其实可以由单个 coder/reviewer 在派发时按任务实际触及的栈加载对应方法论承载。

此外，9-agent 集合引用的多个 skill（frontend-impl-plan、backend-impl-plan、knowledge-search、test-docs、architecture-deepening、architecture-docs、retrospective-correction）在后续轻量化中已不在第一方分发清单（`constants/skills.ts`）内，使 ADR-0002 与实际 `agents/` 目录严重漂移。

## 决策

保留 ADR-0002 的 skill/agent 两层正交模型，但把 agent 集合收敛为固定 5 个跨栈角色 + 按需多实例：

| Agent | 加载的核心 skill | 职责 |
|---|---|---|
| `planner` | `writing-plans`、`test-design` | 冻结范围，产出实现计划 + 验收用例清单（跨栈） |
| `coder` | `test-driven-development`、`unit-testing`、`interaction-testing` | 按计划测试先行写代码，按栈加载测试方法论 |
| `debugger` | `systematic-debugging` | 复现 → 定位根因 → 回传修复建议（只读，跨栈） |
| `consistency-reviewer` | `consistency-check` | 编码后、测试验证前核对最终 diff 是否符合上游事实源 |
| `code-reviewer` | `requesting-code-review` | 测试通过后独立评审最终 diff 的代码质量 |

- **不按前后端硬拆**：栈差异由 `coder`/`code-reviewer` 在派发时按任务实际触及的栈加载对应方法论与关注点承载，而非固化成独立 agent 文件。
- **按需多实例**：真正需要并行且不写同一文件时，再并行起多个 `coder` 实例，各自独立上下文（对应 LLMCompiler / ReWOO 对「任务依赖清晰、产物边界明确、并行不写同一文件」的要求）。
- **临时子代理**：多源只读调研、跨多模块的测试验证按任务派临时研究/验证子代理，不对应固定 `agents/` 文件。
- **reviewer ≠ coder 红线不变**：一致性评审与代码评审都必须由与编码者不同的实例产出。

## 替代方案

- **保留分栈 9-agent**：方法论分散、维护成本高，且角色数量不带来可靠性收益。
- **退回全部留在 skill 层**：无法表达隔离执行与反自评偏袒，代码评审/一致性评审无法强制不同实例。

## 影响

- `agents/` 只保留 5 个第一方 agent 文件；ADR-0002 标记为 superseded，其 9-agent 清单仅作历史记录。
- [agent-layer.md](../agent-layer.md) 同步重写为 5-agent 模型。
- 各 agent 引用的 skill 必须真实存在于分发链；`scripts/check-rules-consistency.ts` 对 agent 存在性、skill 引用存在性、旧 agent 名残留做机器校验。
- 与 `rules/AGENTS.md` 的开发链路编排与子代理调度索引一致：plan/coder/debugger/consistency-reviewer/code-reviewer 由具名 agent 承载，测试验证由 `verification-before-completion` 在主代理或临时验证子代理执行。
