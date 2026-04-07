---
name: typescript
description: TypeScript 类型设计指导，在 JavaScript 基础上补边界类型和无效状态建模。
---

# TypeScript

## 概述

这个 skill 在 `javascript` 的基础上补充类型设计指导。目标是让契约更显式、无效状态更难出现，同时提升重构安全性，而不是重复 JavaScript 的运行时规则。

## 何时使用

在编写或审查 `.ts`、`.tsx` 代码时使用，尤其适合公共契约、共享模型和复杂状态流转。

## 硬约束

1. 避免 `any`；如果边界上不得不用，就立刻隔离并收窄。
2. 为 API、持久化和模块间边界定义显式类型。
3. 在合适的地方用联合、判别字段、品牌类型/值对象把无效状态建模掉。
4. 显式处理可空性，不要把非空断言当成设计策略。

## 流程

1. 先继承 `javascript` 里的行为和模块规则。
2. 优先引入边界类型，例如 request/response、DTO、公共接口。
3. 用判别联合表达状态流转，而不是堆布尔旗标矩阵。
4. 尽早用 parser/validator 函数收窄未知输入，并返回带类型的结果。
5. 优先选择维护者也能一眼看懂的简单类型形状。

## 边界

这个 skill 不替代运行时校验，也不定义框架特定模式。运行时安全继续由 `javascript` 负责，架构细节交给 domain/framework skills。

## 相关 Skills

- `javascript`
- `frontend`, `backend`
- `react`, `vue`
- `testing`, `verification`
- `personal-defaults`
