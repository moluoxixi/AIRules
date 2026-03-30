# Vue Rules Overview

适用于 Vue 3 / Vite / Pinia / Vue Router 项目。

## 架构原则

- 优先使用 Composition API
- store 只放共享状态
- composables 负责复用逻辑
- 页面层处理路由与装配，组件层处理展示

## 相关规则

- [comments.md](./comments.md) - SFC 组件、composables 注释规范
- [testing.md](./testing.md) - Vitest + Vue Test Utils 测试规范
- [verification.md](./verification.md) - ESLint + vue-tsc + Prettier 校验
- [frontend/workflow.md](../frontend/workflow.md) - 页面类任务标准流程
