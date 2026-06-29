# busyming-ai-rules 自我进化闭环评估 · Hook 调整建议

> 评估对象：`busyming-ai-rules` 项目的"capture / distill / recall / reflect / remember"闭环 + 已引入的 hook 机制
> 评估方法：对照 Hermes 协议、QoderWork hook 模型、近期论文（EvolveMem 2605.13941、Agent Skill Eval 2606.11435、arxiv 2604.16968）
> 评估日期：2026-06-29

---

## 一、事实底座（来自只读子代理静态检索，证据强度 STRONG）

| 维度 | 现状 |
|---|---|
| 闭环 5 个 skill | `session-capture` / `distill-candidates` / `recall-memory` / `reflect` / `remember` 齐全 |
| 候选区目录 | `.airules/skills-candidates/`、`.airules/memory-candidates/` **均不存在**（纸面契约） |
| 记忆 schema | 仅 `metadata.type / created_at / status`，无 `recall_count / override_count / last_recalled_at / topic_tags` |
| Hook 文件 | 全仓仅 `hooks/session-log.mjs` 一份 |
| Hook 触发点 | 6 个宿主**全部固定为 Stop/stop**，无 PreToolUse / PostToolUse / SessionStart |
| Hook 职责 | 仅追加一行会话索引到 `.airules/sessions/auto/<date>.log`，设计红线"永不阻断、异常 exit 0、stdout 写 `{}`" |
| 回路熔断字段 | `loop_iteration` / `mismatch_loop` / `blocked_id` / `max_loop` 在 `scripts/` 下零命中，仅在 `workflow-contract.test.ts` 做**文本存在性断言** |
| 库级健康复核 | `distill-candidates` SKILL.md 仅 prose 启发式，零脚本/测试承载 |
| reviewer ≠ coder | 核心门禁第 6 条红线，但只能靠主代理自觉，无技术兜底 |

`issue/DONE-TODO.md` 明示："运行时硬熔断不做（纯 prompt 仓库无派发进程调用）"——这条原始取舍在引入 hook 之后已动摇。

---

## 二、自我进化闭环的核心问题（按风险排序）

### P0-1 · 写入端死链（事实）
候选目录不存在。distill→人工审核→remember 转正这条链**在生产路径上从未跑过**。审核状态没有持久化字段，全靠人脑识别"哪些候选已审"。

### P0-2 · staleness 信号过弱（事实+判断）
schema 只有 `status` 二元开关，没有 `last_recalled_at` 和衰减窗口。superseded 只能由下一次 reflect 人工触发——在那之前过时记忆会**以高置信度被召回**。对照 EvolveMem 主流做法是"召回时降权 + 周期性扫描标记"，AIRules 缺后者。

### P1-3 · 库级健康复核未落地（事实）
Skill 与记忆**只增不减**，淘汰/合并的 4 类信号全部纸面化。我的判断：6 个月内库会膨胀到召回精度明显下降，属于温水煮青蛙型债务。

### P1-4 · reviewer ≠ coder 无技术兜底（事实）
核心门禁第 6 条是红线，但 `workflow-contract.test.ts` 只检查 markdown 里写没写这句话，不检查实际派发。

### P2-5 · boundary 召回 + 计数器责任主体仍是 prose-only
已在 issue 一/二轮登记。

---

## 三、Hook 机制：当前承载 vs 应承载（核心调整建议）

**关键认识**：你已经有了运行时载体，但只用了它 10% 的能力。原"纯 prompt 仓库"取舍已动摇，需要重新分级。

### Tier 1 — 信号收集（不破坏现有红线，立刻可做）

扩展 `session-log.mjs` 在 Stop 时**顺手**做：

1. 解析 transcript 中的子代理派发记录（coder/reviewer/debugger/consistency-reviewer），写入 `.airules/sessions/dispatch-ledger/<date>.jsonl`，字段 `{loop_id, subagent_type, instance_id, parent_loop_iteration}`。**P1-4 与 P2-5 的运行时事实底座**。
2. 扫描 `.airules/memory/` 下所有条目，对超过 N 天未被引用且 `status: active` 的条目生成 `stale-candidates.md`（不修改记忆本身，只产报告）。

**不需要新增 hook 事件，复用现有 Stop，零破坏。**

### Tier 2 — 上下文注入（需要新增 SessionStart hook，软影响）

在 `constants/hosts.ts` 的 `HookProjection` 增加 SessionStart 投影：

1. 读 `.airules/memory/MEMORY.md` 轻索引，按当前用户输入做粗匹配，注入上下文。**这就是把 `recall-memory` 从"主代理自觉"提升到"hook 强制"**，解决核心门禁第 8 条的可观测性。
2. 附上 dispatch-ledger 最近一份的"上一会话已触达 max_loop 的 blocked_id"清单，主代理一开局就知道哪些路径已熔断。

**不阻断对话，只改变上下文起点。**仍兼容原设计红线。

### Tier 3 — 派发拦截（需要 PreToolUse hook + 重新讨论"永不阻断"红线）

只有这一档能真正承载回路熔断 / reviewer≠coder / verification-before-completion 的硬约束：

1. PreToolUse 在 Task/Agent 工具调用前读 dispatch-ledger，检查 `loop_iteration >= max_loop` 或 `coder_instance_id == reviewer_instance_id`，命中则在 stdout 返回 `{"decision": "block", "reason": "..."}`。
2. PostToolUse 在 coder 完成后检查最近 N 步是否真跑了 build/test/lint，否则在 stdout 注入提醒。

**与现有 hook 红线直接冲突**——"永不阻断对话" vs "block 派发"。**必须显式取舍**。

**我的判断**：Tier 3 价值最高（把"纯 prose 红线"变成"运行时 invariant"），但风险也最高（多宿主 hook 协议不统一、阻断逻辑出 bug 会导致整个会话卡死）。Claude/Codex 的 hook 协议支持 decision 字段，Cursor/Trae/Qoder 是否支持**需要核实**——这是 Tier 3 的阻塞性事实。

---

## 四、必须先决策的三件事

下面是我的判断不是确定的事实，由你决定方向。

| 决策 | 选项 A | 选项 B | 我的倾向 |
|---|---|---|---|
| **D1**：是否推翻"不做运行时硬熔断"的原取舍？ | 推翻 → 可做到 Tier 3，真正回路熔断 | 保留 → 最多 Tier 2 | **保留 + 走到 Tier 2**。Tier 3 收益大但多宿主兼容矩阵成本陡增 |
| **D2**：候选区死链先补目录还是先补流程？ | 先补目录 | 先补流程（`scripts/review-candidates.ts`） | **先补流程**，空目录无意义 |
| **D3**：staleness 字段是否升级 schema？ | 加 `last_recalled_at`+衰减 → 需 hook 回写 | 不升级 → 依赖 reflect 人工 | **升级**。这是 P0-2 的根治，不升级=温水煮青蛙 |

---

## 五、对照 Hermes / QoderWork 的一句话定性

> Hermes 强调结构化工具调用 + 上下文契约——AIRules 的 frontmatter 方向走对了，但**字段还停留在"是什么"层面，缺"什么时候不该用"的元数据**（衰减、引用计数、boundary 标签）。
> QoderWork 这类 desktop agent 普遍把 hook 当**被动式约束注入器**用——AIRules 现在的 hook 只用了它 10% 的能力。

---

## 六、推荐落地顺序（如果 D1=保留 / D2=先流程 / D3=升级）

1. **第 1 周**：补 `scripts/review-candidates.ts` + memory schema 增加 `last_recalled_at`（Tier 1 信号收集打底）
2. **第 2 周**：扩展 `session-log.mjs` 输出 dispatch-ledger 与 stale-candidates 报告
3. **第 3 周**：新增 SessionStart hook 投影（Tier 2），把 recall-memory 上升为 hook 强制
4. **观察 1 个月**：用 ledger 数据评估是否值得推进 Tier 3

如需进入实现阶段，下一步**派 planner 子代理**冻结范围 + 列实现计划与验收用例清单。

---

_报告生成：QoderWork · 2026-06-29_
