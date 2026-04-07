---
name: standard-workflow
description: Use when 任务会跨越需求澄清、方案、实现、测试、验证或收尾多个阶段，或用户明确要求按仓库标准流程推进。
---

# Standard Workflow

## 概述

这是这个仓库的第一方入口 skill，用来固定默认交付顺序：

`requirements clarification -> solution/design -> implementation -> testing -> verification -> wrap-up`

它负责回答“当前任务应该先走哪一个阶段”，不负责替代具体技术技能。

## 何时使用

- 任务会跨越多个阶段，而不是一句话就能回答完
- 用户明确要求按仓库标准流程推进
- 当前卡住的原因是“不知道下一步该先做设计、实现还是验证”

## 不在这些情况下使用

- 问题只是一个纯信息型小问答，不需要完整流程
- 你已经明确处在某一个后续阶段，而且只需要更具体的 skill

## 核心指导

- 先澄清需求、约束和成功标准，再决定如何做
- 在实现之前先给出方案或设计，不要直接上手编码
- 实现之后补测试，再做完成前验证
- 最后才进入收尾，汇报结果、风险和下一步

## 常见误区

- 把“我大概知道要做什么”当成已经完成需求澄清
- 把实现草稿当成方案设计
- 测试通过后直接宣称完成，跳过验证和收尾

## 相关 Skills

- `frontend`, `backend`
- `javascript`, `typescript`
- `react`, `vue`
- `testing`, `verification`, `wrap-up`
