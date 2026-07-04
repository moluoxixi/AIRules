# Superpowers 第一方化 + 三套体系冲突消解

## 背景

调研确认三套体系（自建编排 / Superpowers / OpenSpec）在需求/计划/TDD/验证/评审/调试多个环节重叠，且 `constants/skills.ts:209` 的 `kind:'namespace'` 全量分发与注释承诺矛盾（brainstorming/tdd/verification 等实际全被分发，与自建 skill 双份或冲突）。

## 用户决策

1. 把 superpowers 13 个 skill（除 using-superpowers）**逐个拉原文改造**成第一方版，对齐我们契约。
2. 重叠 7 个**用 superpowers 名**（我们现有 skill 改名）。
3. 13 个一次全抵。
4. superpowers vendor **保留但改空精选**（`skills: []` 预留槽位，不分发，避免双份）。
5. using-superpowers（框架自指）不要。

## 命名映射（重叠 7 个：我们现有 → superpowers 名）

| 现有第一方 | 改名为 | 来源改造 |
|---|---|---|
| tdd | test-driven-development | 融合：保留我们"核心TDD+集成/UI事后测试豁免"，吸收上游红绿严格度 |
| verification | verification-before-completion | 对齐我们状态枚举 PASS/FAIL/MISSING/NOT RUN/N/A |
| requirements-analysis | brainstorming | **去 HARD-GATE**，改为"歧义才澄清、L0/L1直接执行"；产物路径 docs/superpowers/specs → knowledge/ + openspec |
| impl-plan | writing-plans | 保留我们可追溯字段（需求来源/契约来源/前后端字段组） |
| code-review | requesting-code-review | 对齐我们 reviewer≠coder、独立实例、分级结论 |
| skill-distill | writing-skills | 对齐我们 candidate 待审、knowledge/skills-candidates |
| systematic-debugging | systematic-debugging（已同名）| 吸收上游4阶段，对齐我们只读诊断+docs/diagnosis |

> consistency-check、test-design、unit-testing、interaction-testing、handoff、session-capture、init-project = 我们独有，**不改名、不动**。

## 独有 6 个（superpowers 独有 → 新建第一方版，对齐契约）

| 新建第一方 skill | 职责 | 改造点 |
|---|---|---|
| executing-plans | 按已写计划在隔离会话执行 + review 检查点 | 对齐我们子代理协议、产物路径 |
| subagent-driven-development | 每任务派 implementer 子代理+任务级review+整支review | 418行，精简；对齐我们 agents（coder/reviewer）协议 |
| dispatching-parallel-agents | 多无依赖任务并行派子代理 | 对齐我们"拆agent须命中隔离/并行/独立性" |
| receiving-code-review | 收到评审先技术核实再实现，不盲从 | 立场类，对齐 |
| using-git-worktrees | 隔离工作区 | 去 Claude-Code 专用引用 |
| finishing-a-development-branch | 实现完成后 merge/PR/清理选项 | 对齐我们 git_safety、不强制 |

## 通用改造规则（逐个抄时统一应用）

1. 去掉 `<HARD-GATE>`、`<EXTREMELY-IMPORTANT>`、`<SUBAGENT-STOP>` 等强制阻断标签，改为与我们门禁一致的"歧义才澄清/L0L1直接执行"。
2. 产物路径 `docs/superpowers/*` → 对齐我们约定（计划/spec 归 knowledge/ + openspec 或 rules 阶段契约位置；诊断 docs/diagnosis）。
3. 去 Claude-Code 专用引用（Skill 工具、特定 slash command）。
4. description：编码流水线核心环节（test-driven-development/writing-plans/brainstorming/verification-before-completion）保留 description 可自动触发；评审/调试/子代理编排类（requesting/receiving-code-review、systematic-debugging、subagent-driven、dispatching-parallel）省略 description 仅按名加载，避免自动触发污染。
4. 行数控制：超大原文（writing-skills 689、subagent-driven 418、test-driven 371）精简到必要方法论，不逐字全抄。
5. 四段式结构（触发条件/不适合场景/输出或写入边界）对齐我们现有 skill 风格。

## 需要同步改的引用（重叠改名牵动）

- `rules/sources/00-overview.md`：阶段契约表 28-34 行的 skill 名（requirements-analysis→brainstorming、impl-plan→writing-plans、tdd→test-driven-development、verification→verification-before-completion、code-review→requesting-code-review）。test-design/unit-testing/interaction-testing/consistency-check/systematic-debugging 不变。
- `agents/planner.md`：impl-plan→writing-plans。
- `agents/coder.md`：tdd→test-driven-development。
- `agents/code-reviewer.md`：code-review→requesting-code-review。
- `agents/consistency-reviewer.md`：引用 code-reviewer（agent名不变，skill引用 code-review→requesting-code-review 处需核）。
- `agents/debugger.md`：systematic-debugging 不变。
- rules:build 重新生成 rules/AGENTS.md。

## constants/skills.ts 改造

- superpowers vendor projection 改为 `kind:'skills', sourceBaseDir:'skills', skills: []`（空精选，预留槽位不分发）。
- 同步改 197-208 行注释，描述真实行为（全部 13 个已第一方化，superpowers 原版不分发，using-superpowers 弃用）。
- 更新 vendors.test.ts 对 superpowers links 的断言（应为空 links）。

## 目录与文件操作

- 重命名 6 个 skill 目录：`git mv skills/tdd skills/test-driven-development` 等。
- 新建 6 个独有 skill 目录。
- 重叠 7 个：在改名后的目录里融合上游内容改造。

## OpenSpec 与三层分工（用户说不了解 OpenSpec，本轮暂不在 rules 写分工节）

- 本轮聚焦 superpowers 冲突消解。OpenSpec 已接入但 rules 未提分工——待用户了解 OpenSpec 后单独处理，不在本计划范围。

## 验证

- rules:build 重新生成成功。
- vitest 全量（含改后的 vendors setup/links 断言）PASS。
- typecheck / lint PASS。
- grep 确认无残留旧 skill 名引用、无 superpowers 双份。
- 手动核每个第一方化 skill：无 HARD-GATE 残留、无 docs/superpowers 路径、无 Claude-Code 专用引用。

## 风险

- 工作量大（13 skill + 6 改名 + rules/agents/constants 联动）。
- 改造尺度主观——逐个抄改时按"通用改造规则"统一，避免夹带上游与我们冲突的纪律。
- 行数：若将来恢复 skill 行数检查，需确保精简后达标。
