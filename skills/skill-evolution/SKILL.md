---
name: skill-evolution
description: 用于复盘发现 SKILL_GAP、RULE_GAP、重复执行偏差或用户要求优化 AIRules skills/rules 时触发。
---

# Skill Evolution

## 来源基线

- Hermes Curator: https://hermes-agent.nousresearch.com/docs/user-guide/features/curator
- Hermes 设计点：只维护 agent-created skills，支持 dry-run、backup、rollback、pin，不直接删除人工维护资产。
- AIRules 适配：只生成 `PENDING_REVIEW` skill 改造候选；核心 first-party skills 必须经用户确认后再改。

## 核心规则

- 输出只写入 `docs/skill-evolution/inbox/`；不得在本 skill 阶段直接修改 `skills/`、`rules/`、`constants/` 或 `vendor/`。
- 每个候选必须说明触发来源、证据、建议修改、影响范围、验证命令和不修改的边界。
- 只把 `retrospective-correction` 归因为 `SKILL_GAP`、`RULE_GAP`、重复偏差或用户明确要求的场景纳入候选。
- `vendor/` 和第三方上游 skill 是只读参考；不得写入、覆盖或自动归档。
- 若候选涉及 first-party core skill，必须标记“需要用户批准后执行”，不得伪装成已应用。
- 运行 `node scripts/verify-learning-candidates.mjs <candidate>`；失败必须修复。

## 候选模板

```markdown
---
kind: skill-evolution
status: PENDING_REVIEW
target: docs/skill-evolution/inbox/YYYY-MM-DD-skill-name.md
---
# <skill 或 rule 改造主题>

## 参考来源
- https://hermes-agent.nousresearch.com/docs/user-guide/features/curator
- <复盘文档、测试失败或用户反馈>

## 证据
- <说明为什么这是 skill/rule 缺口，而不是一次性执行错误>

## 候选内容
- <建议修改哪些 skill/rule 文本、脚本或测试>

## 应用边界
- 不直接修改 `skills/` 或 `rules/`；等待用户批准和实现计划。
```

## 评审口径

优先生成候选：
- 同类错误重复出现，现有 skill 没有可执行检查点。
- 用户指出 AI 偏离要求，且复盘判断为 `SKILL_GAP` 或 `RULE_GAP`。
- 某个 skill 的 description、正文、脚本或测试会误导代理。

拒绝生成候选：
- 单次误操作已经由现有规则明确覆盖。
- 只是想扩大第三方 skill 安装范围但没有仓库适配证据。
- 修改会引入自动任务生命周期、静默归档、失败降级或未经确认的正式写入。
