---
name: testing
description: Use when 行为已经变化，需要补测试、决定先跑哪些检查，或为改动提供直接测试证据。
---

# Testing

## Overview

这个 skill 定义仓库级的测试习惯，用来补充 `superpowers/test-driven-development`，帮助智能体决定如何补测试、如何整理测试证据。

## Quick Reference

- 先遵守 `superpowers/test-driven-development`
- 先跑最小相关测试，再逐步放大
- 至少保留一个直接覆盖改动行为的测试或断言
- 记录命令、通过/失败结果和必要的失败信息
- skill 树结构变更时优先跑 `node --test tests/skill-first-layout.test.mjs`

## Common Mistakes

- 只跑大而全的测试，不先确认最小失败面
- 用脆弱断言验证格式，而不是验证行为
- 明明还有测试缺口，却不在交接时说明

## Related Skills

- `standard-workflow`
- `superpowers/test-driven-development`
- `verification`
- `wrap-up`
