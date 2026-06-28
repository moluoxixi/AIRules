---
name: memory-needs-review-like-skills
description: 自动提炼的记忆须与 skill 候选同等走人工审核，因为 recall 每次读回会放大错误记忆的污染
metadata:
  type: decision
  created_at: 2026-06-27
  status: active
---

进化闭环中，自动从会话提炼的记忆必须与 skill 候选同等走「候选 + 人工审核转正」，不直接写入正式记忆库 `.airules/memory/`。

**理由**：记忆被 `recall-memory` 在每次任务起始读回当背景，一条错误记忆会持续污染之后所有任务的判断——这个风险不低于 skill 候选（skill 错了行为偏，记忆错了事实偏），只是表现形式不同。因此"记忆风险低、可直接写"的早期论证不成立。

**例外**：用户当场口述"记住这条"由 `remember` 显式即写——口述本身即审核，不绕候选。只有自动提炼那条路（`distill-candidates`）才强制候选 + 待审。

支撑 skill：`distill-candidates`（双路提炼，两类候选都待审）、`remember`（两个入口：显式即写 / 转正已批准候选）、`recall-memory`（读回时的快照复核纪律）。
