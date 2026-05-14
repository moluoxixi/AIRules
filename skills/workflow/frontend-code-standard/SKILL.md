---
name: frontend-code-standard
description: 用于编写、修改或评审前端代码，适用于 UI、组件、页面、路由、状态、API 客户端、hooks、composables、类型模型、命名、目录结构和模块边界。
---

# 前端代码规范

## 用途

本 Skill 提供前端代码的可复用规范，覆盖命名、目录结构、模块边界、注释、API 对齐和 UI 逻辑组织。

优先遵循项目已有约定；项目没有明确约定时，可将本 Skill 作为默认参考。

## 适用场景

- 新增或调整前端组件、页面、路由、状态、API 调用、hooks 或 composables。
- 评审前端模块边界、类型模型、命名、目录放置和 UI 逻辑组织。
- 需要判断某段逻辑应该留在视图、抽到 hook/composable、放入 service/store，还是成为纯工具函数。

## 读取参考

- 通用命名、注释、共置、API 对齐和 TypeScript 原则：读 [common.md](references/common.md)。
- 目录和功能结构：读 [directory-structure.md](references/directory-structure.md)。
- Vue SFC、composables、refs 和事件：读 [vue.md](references/vue.md)。
- React 组件、hooks、refs 和事件：读 [react.md](references/react.md)。
- TypeScript / JavaScript 命名和示例：读 [typescript-javascript.md](references/typescript-javascript.md)。

## 核心判断

- 视图文件聚焦渲染和事件装配；数据加载、校验、派生状态和业务规则优先放入 hook、composable、store、service 或纯模块。
- 类型和常量能帮助表达契约时，应先定义契约再实现逻辑。
- 特性专属文件优先靠近特性；确有跨特性复用后再上移到共享目录。
- 前端字段应对齐后端/API 契约；没有明确需求时，不引入兼容字段、伪数据或静默 fallback。
- 注释用于说明职责、边界、输入输出约束、副作用和失败语义，避免只复述代码行为。

## 关联 Skill

- Vue 代码可结合 `vue-best-practices`；Vue 测试可结合 `vue-testing-best-practices`。
- React 代码可结合已安装的 React 专项 Skill；没有专项 Skill 时，按本规范中的组件纯度和 hook 边界原则执行。
- 样式、可访问性或视觉评审可结合 `web-design-guidelines`。
