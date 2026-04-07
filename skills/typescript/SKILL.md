---
name: typescript
description: Use when 编辑 .ts / .tsx，或需要设计边界类型、公共接口、联合状态与类型收窄。
---

# TypeScript

## 概述

这个 skill 在 `javascript` 的基础上补充类型设计判断，重点是边界类型、公共接口、状态建模和类型收窄。

它不重复 JavaScript 的运行时规则，而是处理 TypeScript 的类型层问题。

## 何时使用

- 正在编辑 `.ts`、`.tsx`
- 需要设计公共接口、请求/响应、DTO 或共享模型
- 需要用联合、判别字段、收窄来表达复杂状态

## 不在这些情况下使用

- 问题只涉及 JavaScript 运行时流程，而不涉及类型设计
- 问题主要是 React / Vue 的框架模式选择

## 核心指导

- 先继承 `javascript` 的模块和运行时约束，再补类型层设计
- 为 API、模块和持久化边界定义显式类型
- 避免 `any`，必要时尽快收窄
- 用联合和判别字段减少无效状态，让状态流转更清晰

## 常见误区

- 用 `any` 省事，后面再补
- 把布尔旗标堆成状态矩阵，而不是建模状态本身
- 依赖非空断言掩盖真实的可空问题

## 相关 Skills

- `javascript`
- `frontend`, `backend`
- `react`, `vue`
- `testing`, `verification`
