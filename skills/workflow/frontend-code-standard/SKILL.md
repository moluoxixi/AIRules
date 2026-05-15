---
name: frontend-code-standard
description: 用于编写、修改或评审 Vue 3 与 TypeScript 前端代码，强制执行分形架构、特性驱动目录、就近内聚、细粒度类型拆分、统一导出和依赖流向约束。
---

# 前端编码规范

## 用途

本 Skill 是 Vue 3 与 TypeScript 前端代码的唯一编码规范来源。

生成、重构或修改前端代码时，必须优先遵循分形架构（Fractal Architecture）和特性驱动（Feature-Driven）组织原则：每个复杂组件或业务模块都视为自治的微型应用，所有类型、工具、状态和子组件默认就近放置。

## 适用场景

- 新增或调整 Vue 3 组件、业务视图、业务模块和复杂组件。
- 评审前端目录结构、组件边界、模块边界、状态归属、类型拆分、导出入口和 import 路径。
- 判断类型、工具、composable、常量、API 定义是否应该留在当前模块，还是满足三次法则后上浮。

## 必读规范

前端编码与目录创建不可拆开理解，必须完整读取 [fractal-frontend-standard.md](references/fractal-frontend-standard.md)。

## 硬性原则

- 禁止扁平化：模块专用的类型、工具、composable、常量、API 定义和子组件不得提升到全局目录。
- 递归结构：复杂子组件必须拥有与父级一致的目录层级能力，包括自己的 `types/`、`constants/`、`utils/`、`composables/` 和 `components/`。
- 统一导出：任意功能集目录必须提供 `index.ts` 作为唯一对外 API 入口，新增子文件必须立即由同级 `index.ts` 显式导出。
- Deep Imports 零容忍：模块引用同级目录或其他模块暴露资源时，只能导入目录入口，不得穿透到具体文件。
- 状态局部闭环：新的状态和业务逻辑默认属于当前组件或模块；只有满足三次法则后才允许上浮。
- 依赖自上而下：父级模块只能导入自身内部子目录暴露的入口；禁止同级模块跨域导入对方私有文件。
