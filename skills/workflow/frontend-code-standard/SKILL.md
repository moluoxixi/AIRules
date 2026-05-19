---
name: frontend-code-standard
description: 用于编写、修改或评审 Vue 3 或 React TypeScript/JavaScript 前端应用、前端工具库和 UI 组件库代码。
---

# 前端编码规范

## 用途

本 Skill 是 Vue 3 或 React TypeScript/JavaScript 前端应用、前端工具库和 UI 组件库代码的唯一编码规范来源。

生成、重构或修改前端代码时，必须优先遵循分形架构（Fractal Architecture）和特性驱动（Feature-Driven）组织原则：每个复杂组件或业务模块都视为自治的微型应用，复杂状态、跨组件复用逻辑和副作用编排必须从视图层剥离。

## 适用场景

- 新增或调整 Vue 3 / React 组件、业务视图、业务模块、复杂组件、前端工具库和 UI 组件库，包含 TypeScript 与 JavaScript 入口。
- 评审前端目录结构、组件边界、模块边界、Headless 状态逻辑、类型推导、类型拆分、导出入口和 import 路径。
- 判断类型、工具、composable、hook、常量、API 定义是否应该留在当前模块、当前库包，还是满足三次原则后逐级上浮。

## 必读规范

前端编码与目录创建不可拆开理解，必须完整读取 [fractal-frontend-standard.md](references/fractal-frontend-standard.md)。

## 验证辅助

本 Skill 自带 `scripts/verify-rules.mjs`，用于快速验证前端专属的三次原则、最近公共父级抽离位置、模块结构、简单组件结构、复杂组件包结构、前端工具库结构和 UI 组件库结构。该脚本只属于本 Skill，不得用仓库根级共享脚本替代。

## 硬性原则

- 逻辑与 UI 分离：复杂业务状态、跨组件复用逻辑和副作用编排必须进入模块私有 `composables/` 或 `hooks/`；简单局部交互状态可留在视图入口，避免为拆分而拆分。
- 禁止扁平化：模块专用的类型、工具、状态逻辑和子组件不得盲目提升到全局目录。
- 递归结构：复杂子组件必须使用复杂组件包结构承载私有作用域；简单展示组件只能保持单文件形态。
- 复杂组件包结构：复杂组件包或项目级组件封装必须包含 `README.md`、唯一公共入口 `index.ts` 或 `index.js`，以及 `src/`；`src/` 内必须保留唯一实现入口 `index.vue`、`index.tsx` 或 `index.jsx` 之一。
- 库包结构：前端工具库和 UI 组件库必须包含 `README.md`、唯一公共入口 `index.ts` 或 `index.js`，以及 `src/`；`src/` 内必须通过 `index.ts` 或 `index.js` 聚合真实实现。
- 单个模块结构：单个业务模块不得再嵌套 `src/`，也不得在模块根目录创建 `index.ts` 或 `index.js`；模块根目录只保留唯一实现入口 `index.vue`、`index.tsx` 或 `index.jsx` 之一。
- 简单组件结构：无内部状态、无复杂交互、无需暴露实例能力的简单组件直接使用 `ComponentName.vue`、`ComponentName.tsx` 或 `ComponentName.jsx`，不得为简单组件额外制造包目录。
- 目录入口：除简单组件文件、单个业务模块根目录和 `styles/` 目录外，其他代码目录一旦创建，必须提供唯一 `index.ts` 或 `index.js` 作为目录聚合入口。
- 样式目录入口：`styles/` 目录一旦创建，必须提供唯一 `index.css`、`index.scss` 或 `index.less` 作为样式入口。
- 包级导出：只有复杂组件包、前端工具库和 UI 组件库允许通过 `index.ts` 或 `index.js` 暴露公共 API。
- 路径别名优先：跨模块引用或多层向上查找时，必须优先使用项目配置的路径别名。
- Deep Imports 零容忍：无论相对路径还是别名，都不得穿透到具体文件。
- 逐级上浮：满足三次原则后只能提取到最近公共父级，只有跨顶级业务域复用才允许进入 `src/` 根级公共目录。
- 类型推导优先：前端类型必须优先从现有组件、Hook、Composable、API 响应、Schema 或常量对象推导，禁止重复手写可由源数据表达的类型。
- 注释解释 Why over What：核心类型契约、公用工具和复杂副作用必须写清设计意图、默认值、依赖变化原因、目标和闭包边界。
