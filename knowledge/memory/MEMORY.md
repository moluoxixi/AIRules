# AIRules 项目记忆索引

- [记忆需与 skill 同等审核](memory-needs-review-like-skills.md) — 自动提炼的记忆走候选+审核，因 recall 反复读回会放大错误记忆的污染
- [跨宿主 hook 能力基线](cross-host-hook-capability-2026-06.md) — 五宿主 hook 能力参考；当前 AIRules 仅分发 common Stop session-log hook
- [完成类 hook 永不阻断](hook-never-block-stop-events.md) — Stop 等完成类 hook 恒 exit 0，是设计立场非能力限制；翻案须先立 ADR
- [已废弃的 PreToolUse 阻断策略](pretooluse-block-only-three-signals.md) — superseded；仅作历史记录，当前不再分发对应 hook
- [项目 skill 不盲创宿主目录](project-skill-no-host-global-write.md) — 项目级 skill 不得引用 ~/.claude 等宿主全局目录建资产，check #9 兜底
