---
name: javascript
description: JavaScript 实现指导，覆盖异步行为、模块边界、运行时安全和可读性。
---

# JavaScript

## 概述

这个 skill 负责 JavaScript 特有的实现决策，重点是让运行时行为显式化、异步流程可预测、错误面清晰可见。

## 何时使用

在混合仓库中编写或审查 `.js`、`.mjs`，或以 JavaScript 为主的逻辑时使用。

## 硬约束

1. 不要留下未处理的 Promise 拒绝。
2. 模块要小而明确，输入输出清晰。
3. 外部输入一律视为不可信，使用前先校验。
4. 不要用静默兜底隐藏失败。

## 流程

1. 先定义模块边界，再开始编码；一个单元最好只有一个变化理由。
2. 在合适的时候优先用 `async/await`，不要堆嵌套链式调用。
3. 保持数据变换可读，优先具名步骤而不是密集的一行写法。
4. 错误要暴露足够上下文，既方便排查，又不破坏调用方的稳定行为。
5. 为成功路径、预期失败路径和边界情况补测试。

## 边界

这个 skill 不负责 domain 架构（`frontend`/`backend`）或框架细节（`react`/`vue`）。如果需要静态类型建模和编译期保证，再叠加 `typescript`。

## 相关 Skills

- `standard-workflow`
- `frontend`, `backend`
- `typescript`
- `testing`, `verification`
- `personal-defaults`
