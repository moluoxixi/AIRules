---
name: standard-workflow
description: Use when 任务会跨越需求澄清、方案、实现、测试、验证或收尾多个阶段，或用户明确要求按仓库标准流程推进。
---

# Standard Workflow

## 概述

这是这个仓库的第一方入口 skill，用来帮助智能体判断当前任务应该按什么阶段顺序推进。

默认顺序是：
`requirements clarification -> solution/design -> implementation -> testing -> verification -> wrap-up`

## 何时使用

- 任务不是一句话就能回答完，而是会跨越多个阶段
- 用户明确要求“按标准流程走”
- 当前卡住的原因是“不确定下一步该先做设计、实现还是验证”

## 不在这些情况下使用

- 问题只是一个纯信息型小问答
- 你已经明确处在某个具体阶段，只需要更细的技术或阶段 skill

## 快速参考

- 先澄清需求，再决定方案
- 先有方案，再进入实现
- 实现之后补测试
- 测试之后再做验证
- 收尾时总结结果、风险和下一步

## 常见误区

- 把“我大概知道要做什么”当成已经完成需求澄清
- 把实现草稿当成方案设计
- 测试跑过就直接宣称完成，跳过验证和收尾

## 相关 Skills

- `frontend`, `backend`
- `javascript`, `typescript`
- `react`, `vue`
- `testing`, `verification`, `wrap-up`
