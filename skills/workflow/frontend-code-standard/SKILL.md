---
name: frontend-code-standard
description: 用于编写、修改或评审 Vue 3 或 React TypeScript/JavaScript 前端代码，强制执行分形架构、特性驱动目录、Headless 逻辑、路径别名、逐级上浮、类型拆分、统一导出、依赖流向和注释契约。
---

# 前端编码规范

## 用途

本 Skill 是 Vue 3 或 React TypeScript/JavaScript 前端代码的唯一编码规范来源。

生成、重构或修改前端代码时，必须优先遵循分形架构（Fractal Architecture）和特性驱动（Feature-Driven）组织原则：每个复杂组件或业务模块都视为自治的微型应用，核心业务状态和交互逻辑必须从视图层剥离。

## 适用场景

- 新增或调整 Vue 3 / React 组件、业务视图、业务模块和复杂组件，包含 TypeScript 与 JavaScript 入口。
- 评审前端目录结构、组件边界、模块边界、Headless 状态逻辑、类型拆分、导出入口和 import 路径。
- 判断类型、工具、composable、hook、常量、API 定义是否应该留在当前模块，还是满足三次原则后逐级上浮。

## 必读规范

前端编码与目录创建不可拆开理解，必须完整读取 [fractal-frontend-standard.md](references/fractal-frontend-standard.md)。

## 验证辅助

本 Skill 自带 `scripts/verify-rules.mjs`，用于快速验证前端专属的三次原则、最近公共父级抽离位置、模块结构和组件包结构。该脚本只属于本 Skill，不得用仓库根级共享脚本替代。

## 硬性原则

- 逻辑与 UI 分离：核心业务状态和交互逻辑必须进入模块私有 `composables/` 或 `hooks/`，视图入口仅负责渲染和组装。
- 禁止扁平化：模块专用的类型、工具、状态逻辑和子组件不得盲目提升到全局目录。
- 递归结构：复杂子组件必须拥有与父级一致的目录层级能力和私有作用域。
- 组件包结构：组件包或项目级封装必须包含 `README.md`、唯一公共入口 `index.ts` 或 `index.js`，以及 `src/`；`src/` 内必须保留唯一实现入口 `index.vue`、`index.tsx` 或 `index.jsx` 之一。
- 单个模块结构：单个业务模块不得再嵌套 `src/`；模块根目录必须同时提供唯一公共入口 `index.ts` 或 `index.js`，以及唯一实现入口 `index.vue`、`index.tsx` 或 `index.jsx` 之一。
- 统一导出：任意功能集目录必须提供 `index.ts` 或 `index.js` 作为唯一对外 API 入口。
- 路径别名优先：跨模块引用或多层向上查找时，必须优先使用项目配置的路径别名。
- Deep Imports 零容忍：无论相对路径还是别名，都不得穿透到具体文件。
- 逐级上浮：满足三次原则后只能提取到最近公共父级，只有跨顶级业务域复用才允许进入 `src/` 根级公共目录。
- 注释解释 Why over What：核心类型契约、公用工具和复杂副作用必须写清设计意图、默认值、依赖变化原因、目标和闭包边界。
