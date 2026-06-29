# AIRules 项目记忆索引

- [记忆需与 skill 同等审核](memory-needs-review-like-skills.md) — 自动提炼的记忆走候选+审核，因 recall 反复读回会放大错误记忆的污染
- [跨宿主 hook 能力基线](cross-host-hook-capability-2026-06.md) — 五宿主 PreToolUse 普遍支持但仅 guardrail；改 hook 投影/立阻断前先查此条事实
- [完成类 hook 永不阻断](hook-never-block-stop-events.md) — Stop/SubagentStop 恒 exit 0，是设计立场非能力限制；翻案须先立 ADR
- [PreToolUse 仅三类客观信号阻断](pretooluse-block-only-three-signals.md) — loop-guard 只在回路超限/blocked_id/agent 重叠下 exit 2，不得主观判断阻断
- [项目 skill 不盲创宿主目录](project-skill-no-host-global-write.md) — 项目级 skill 不得引用 ~/.claude 等宿主全局目录建资产，check #9 兜底
