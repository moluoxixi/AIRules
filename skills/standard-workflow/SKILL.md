---
name: standard-workflow
description: 定义默认交付顺序的第一方入口 skill，从需求澄清一直到收尾。
---

# Standard Workflow

## 概述

这是这个仓库的第一方入口 skill，用来固定默认工作顺序：

`requirements clarification -> solution/design -> implementation -> testing -> verification -> wrap-up`

先启用它，再按任务叠加 domain、language、framework 和 phase skills。

## 何时使用

在这个仓库里启动新任务、重设任务范围，或阶段衔接不清楚时使用。

## 硬约束

1. 在设计和实现之前，不要跳过需求澄清。
2. 在实现之前，不要跳过方案或设计。
3. 在测试和验证都拿到新的证据之前，不要宣称完成。

## 流程

1. 先澄清需求、约束和成功标准。
2. 编码前先给出具体方案或设计思路。
3. 以小步、可审查的方式实现。
4. 运行与任务相符的测试。
5. 用需求和测试证据验证结果。
6. 最后用简洁方式总结改动、剩余风险和下一步。

## 边界

这个 skill 只负责阶段顺序和流程预期，不替代 domain、language、framework 或 phase skills 的技术细节。

## 相关 Skills

- `frontend`, `backend`
- `javascript`, `typescript`
- `react`, `vue`
- `testing`, `verification`, `wrap-up`
