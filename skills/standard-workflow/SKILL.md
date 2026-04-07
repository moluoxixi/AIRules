---
name: standard-workflow
description: Use when 任务会跨越需求澄清、方案、实现、测试、验证或收尾多个阶段，或用户明确要求按仓库标准流程推进。
---

# Standard Workflow

## Overview

这是这个仓库的第一方入口 skill，用来帮助智能体判断当前任务应该按什么阶段顺序推进。

默认顺序是：
`requirements clarification -> solution/design -> implementation -> testing -> verification -> wrap-up`

## Quick Reference

- 先澄清需求，再决定方案
- 先有方案，再进入实现
- 实现之后补测试
- 测试之后再做验证
- 收尾时总结结果、风险和下一步

## Common Mistakes

- 把“我大概知道要做什么”当成已经完成需求澄清
- 把实现草稿当成方案设计
- 测试跑过就直接宣称完成，跳过验证和收尾

## Related Skills

- `frontend`, `backend`
- `javascript`, `typescript`
- `react`, `vue`
- `testing`, `verification`, `wrap-up`
