---
name: react
description: Use when 任务涉及 React / Next.js 组件、hooks、server/client 边界、页面交互或路由层状态。
---

# React

## 概述

这个 skill 在 `frontend` 和 `typescript` 之上补充 React / Next.js 的具体判断，重点是组件、hooks、server/client 边界和渲染策略。

## 何时使用

- 任务涉及 React / Next.js 组件、hooks 或页面交互
- 需要判断 server component、client component 或混合模式
- 需要处理路由层状态、异步 UI 行为或客户端副作用

## 不在这些情况下使用

- 你还停留在跨框架页面/组件边界讨论阶段
- 问题主要是 TypeScript 类型设计，而不是 React 模式选择

## 快速参考

- 先继承 `frontend` 的边界，再继承 `typescript` 的契约
- 有意识地选择 server/client 边界
- hooks 必须保持顶层、确定性调用
- 异步 UI 仍然要显式处理加载、空态和错误状态
- 共享逻辑优先抽成 custom hook

## 常见误区

- 随手加 `'use client'`，掩盖错误边界
- 把副作用塞进 `useEffect` 却不控制依赖和幂等
- 本该抽成 hook 的逻辑散落在多个组件里

## 相关 Skills

- `standard-workflow`
- `frontend`
- `typescript`
- `testing`
- `verification`
