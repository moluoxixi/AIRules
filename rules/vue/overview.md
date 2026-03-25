# Vue Rules Overview

适用于 Vue 3 / Vite / Pinia / Vue Router 项目。

- 优先使用 Composition API
- store 只放共享状态
- composables 负责复用逻辑
- 页面层处理路由与装配，组件层处理展示
- composables、导出组件与复杂工具函数的注释遵循 `rules/frontend/jsdoc.md`
- 页面类任务的实现与验证流程遵循 `rules/frontend/workflow.md`
