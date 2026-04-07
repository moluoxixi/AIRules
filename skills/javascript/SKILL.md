---
name: javascript
description: Use when 编辑 .js / .mjs，或问题涉及异步流程、运行时校验、模块边界与错误处理。
---

# JavaScript

## Overview

这个 skill 处理 JavaScript 特有的实现问题，重点是运行时行为、异步流程、模块边界、可读性和错误处理。

它不负责 TypeScript 的类型设计，而是聚焦 JavaScript 运行时本身。

## When to Use

- 正在编辑 `.js`、`.mjs` 或以 JavaScript 为主的逻辑
- 问题涉及 `async/await`、Promise、运行时校验或错误传播
- 你在判断模块边界怎么拆更清晰、更可读

When NOT to use:
- 问题主要是 `.ts` / `.tsx` 的类型设计
- 问题主要是 React / Vue 的框架层模式选择

## Quick Reference

- 让运行时行为显式化
- 异步流程优先用清晰的 `async/await` 表达
- 模块边界要明确，输入输出清晰
- 数据变换要可读，不要为了短而堆一行
- 错误要有上下文，不能被静默吞掉

## Common Mistakes

- Promise 拒绝未处理
- 模块职责混乱，边界不清
- 牺牲可读性去追求短代码
- 只顾成功路径，不设计错误行为

## Related Skills

- `standard-workflow`
- `frontend`, `backend`
- `typescript`
- `testing`, `verification`
