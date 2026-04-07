---
name: typescript
description: Use when 编辑 .ts / .tsx，或需要设计边界类型、公共接口、联合状态与类型收窄。
---

# TypeScript

## Overview

这个 skill 在 `javascript` 之上补充类型设计问题，重点是边界类型、公共接口、联合状态和类型收窄。

它不重复 JavaScript 的运行时规则，而是解决 TypeScript 的类型层问题。

## Quick Reference

- 先继承 `javascript` 的模块和运行时约束
- 为 API、模块和持久化边界定义显式类型
- 避免 `any`，必要时尽快收窄
- 用联合和判别字段减少无效状态
- 让类型形状保持可理解、可维护

## Common Mistakes

- 用 `any` 先绕过去，之后再补
- 用布尔旗标堆状态矩阵，而不是直接建模状态
- 依赖非空断言来掩盖真实可空问题

## Related Skills

- `javascript`
- `frontend`, `backend`
- `react`, `vue`
- `testing`, `verification`
