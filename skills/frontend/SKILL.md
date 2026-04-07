---
name: frontend
description: Use when 处理页面、组件、交互或状态归属，或需要明确 loading / empty / error 等前端界面状态。
---

# Frontend

## 概述

这个 skill 负责跨框架共享的前端问题，重点是页面/组件边界、状态归属和交互完整性。

它解决的是跨框架前端共性，而不是 React hooks、Vue composables 这类框架特有细节。

## 何时使用

- 任务涉及页面、组件、交互、状态归属
- 需要设计或修正 loading / empty / error 等界面状态
- 你在判断哪些逻辑应该放在页面层，哪些应该放在可复用组件层

## 不在这些情况下使用

- 问题主要是 React hooks、Next.js server/client 边界等框架特有细节
- 问题主要是 Vue composables、Nuxt 数据流或 store 约定
- 任务本质上是后端 API、service、校验或副作用设计

## 核心指导

- 保持跨框架视角，先划清页面层和组件层的职责边界
- 把状态放在能够满足交互需求的最低层级
- 每个异步界面都要显式处理加载、空态和错误状态
- 交互行为必须完整，成功、失败、禁用、重试都要有明确路径

## 常见误区

- 组件既负责展示又负责页面编排，导致职责混杂
- 只做 happy path，没有补齐空态、异常态和禁用态
- 明明是框架特有问题，却还停留在跨框架层面讨论

## 相关 Skills

- `standard-workflow`
- `javascript`, `typescript`
- `react`, `vue`
- `backend`
- `testing`, `verification`
