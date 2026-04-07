---
name: javascript
description: Use when 编辑 .js / .mjs，或问题涉及异步流程、运行时校验、模块边界与错误处理。
---

# JavaScript

## 概述

这个 skill 负责 JavaScript 特有的实现判断，重点是异步流程、运行时安全、模块边界、可读性和错误处理。

它处理的是 JavaScript 的运行时问题，而不是 TypeScript 的类型设计。

## 何时使用

- 正在编辑 `.js`、`.mjs` 或以 JavaScript 为主的逻辑
- 问题涉及 `async/await`、Promise、运行时校验或错误传播
- 你在判断模块边界怎么拆才更清晰、可读

## 不在这些情况下使用

- 需求主要是 `.ts` / `.tsx` 的类型建模、公共接口和联合状态
- 需求主要是框架层问题，例如 React hooks 或 Vue composables

## 核心指导

- 让运行时行为显式化，不要留下隐含假设
- 用 `async/await` 或清晰的 Promise 流程表达异步逻辑
- 保持模块边界明确，输入输出清晰
- 数据变换要可读，错误也要暴露足够上下文

## 常见误区

- 把 Promise 拒绝丢给运行时兜底
- 用一行链式或嵌套逻辑牺牲可读性
- 只顾 happy path，不设计错误传播方式

## 相关 Skills

- `standard-workflow`
- `frontend`, `backend`
- `typescript`
- `testing`, `verification`
