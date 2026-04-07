---
name: react
description: 叠加在 frontend 和 typescript 之上的 React / Next.js 指导。
---

# React

## 概述

这个 skill 在 `frontend` 和 `typescript` 之上补充 React / Next.js 的具体判断，重点是组件边界、hook 纪律以及现代 React 应用里的渲染/取数选择。

## 何时使用

在实现或审查 React / Next 代码时使用，例如 `.tsx`、route handlers、server/client components、hooks 和 UI 状态流。

## 硬约束

1. 尊重 Next.js 的 server/client 边界；只有确实需要交互时才使用 `'use client'`。
2. hooks 要保持确定性并位于顶层，避免条件式调用。
3. 优先派生状态和受控数据流，不要复制局部状态。
4. 异步 UI 必须显式处理加载、空态和错误状态。

## 流程

1. 先继承 `frontend` 的边界和 `typescript` 的契约。
2. 有意识地选择渲染策略：server component、client component 或混合模式。
3. 把 `useEffect` 中的副作用压到最小且保持幂等，纯计算移到 effect 外。
4. 共享逻辑出现时优先抽成 custom hook。
5. 检查交互路径、基础可访问性和路由级状态流转。

## 边界

这个 skill 不替代 `frontend` 和 `typescript` 的共享规则，也不重定义 testing/verification 流程；相关阶段仍交给 `testing` 和 `verification`。

## 相关 Skills

- `standard-workflow`
- `frontend`
- `typescript`
- `testing`
- `verification`
- `personal-defaults`

