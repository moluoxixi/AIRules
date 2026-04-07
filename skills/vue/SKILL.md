---
name: vue
description: 叠加在 frontend 和 typescript 之上的 Vue / Nuxt 指导。
---

# Vue

## 概述

这个 skill 在 `frontend` 和 `typescript` 之上补充 Vue / Nuxt 的具体判断，重点是 composable-first 结构、清晰的响应式归属，以及显式的数据加载行为。

## 何时使用

在实现或审查 Vue / Nuxt 代码时使用，例如 `.vue`、composables、stores 和路由/页面数据流。

## 硬约束

1. 保持响应式归属清晰，避免任意组件直接修改共享状态。
2. 用 `computed` 做派生，用 `watch` 做副作用，不要把两者混在一起。
3. composables 要聚焦且可复用，避免大而全的页面专用 composable 把视图逻辑藏起来。
4. 页面和组件里的异步数据都要显式处理加载、空态和错误状态。

## 流程

1. 先继承 `frontend` 的边界和 `typescript` 的契约。
2. 根据共享需求决定状态放在哪：`ref` / `reactive`、composable 或 store。
3. 在 Nuxt 中有意识地选择 server/client 数据行为，例如 `useAsyncData`、`useFetch`、route middleware。
4. 保持模板逻辑可读，把非平凡逻辑移进 script/composables。
5. 检查交互完整性、基础可访问性和路由切换行为。

## 边界

这个 skill 不替代 `frontend` 和 `typescript` 的共享规则，也不定义 phase-level 的测试或完成验证；这些阶段仍使用 `testing` 和 `verification`。

## 相关 Skills

- `standard-workflow`
- `frontend`
- `typescript`
- `testing`
- `verification`
- `personal-defaults`

