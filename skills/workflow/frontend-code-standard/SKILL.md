---
name: frontend-code-standard
description: 用于编写、修改或评审 Vue 3 或 React TypeScript/JavaScript 前端应用、前端工具库和 UI 组件库代码。
---

# 前端编码规范

## 用途

本 Skill 是 Vue 3 或 React TypeScript/JavaScript 前端应用、前端工具库和 UI 组件库代码的唯一编码规范来源。

本 Skill 重点约束目录拆分、入口模型、模块边界、公共导出和 import 路径。业务实现是否抽离由项目既有模式和真实维护成本决定；不得仅因规则存在而强制拆分。

## 适用场景

- 新增或调整 Vue 3 / React 组件、业务视图、业务模块、复杂组件、前端工具库和 UI 组件库，包含 TypeScript 与 JavaScript 入口。
- 评审前端目录结构、组件边界、模块边界、导出入口和 import 路径。
- 判断类型、工具、常量、API 定义是否应该留在当前模块、当前库包，还是满足三次原则后逐级上浮。

## 规则源与辅助材料

本文件是前端编码规范的唯一规则源。需要辅助材料时按需读取：

- 业务模块示例：[business-module.md](examples/business-module.md)
- 组件示例：[component.md](examples/component.md)
- 工具示例：[utility.md](examples/utility.md)
- 类型出口与导入示例：[types-and-imports.md](examples/types-and-imports.md)
- 校验脚本用法与检查清单：[checklist.md](validation/checklist.md)

## 验证辅助

本 Skill 自带 `scripts/verify-rules.mjs`，用于快速验证前端专属的三次原则、最近公共父级抽离位置、模块结构、简单组件结构、复杂组件包结构、前端工具库结构和 UI 组件库结构。该脚本只属于本 Skill，不得用仓库根级共享脚本替代。

## 结构约束

- 按需拆分：目录拆分只服务入口、复用和维护边界；没有真实复用、独立入口或协作成本时，不为形式化拆分创建子目录。
- 禁止扁平化：模块专用的类型、工具和子组件不得盲目提升到全局目录。
- 递归结构：需要独立目录的复杂子组件使用复杂组件包结构承载私有作用域；简单展示组件保持单文件形态。
- 入口模型：前端目录统一遵循“单一入口，按需拆分”；入口只允许一份，子目录只在真实需要时创建。
- 入口形态：简单组件用 `ComponentName.vue` / `.tsx` / `.jsx`；业务模块用根 `index.vue` / `.tsx` / `.jsx`，禁止根 `index.ts` / `.js` 和 `src/`；复杂组件、前端工具库、UI 组件库用根 `index.ts` / `.js` + `src/`；普通代码目录用 `index.ts` / `.js`；`styles/` 用 `index.css` / `.scss` / `.less`。
- 包级导出：只有复杂组件包、前端工具库和 UI 组件库允许通过 `index.ts` 或 `index.js` 暴露公共 API。
- 路径别名优先：跨模块引用或多层向上查找时，必须优先使用项目配置的路径别名。
- Deep Imports 零容忍：无论相对路径还是别名，都不得穿透到具体文件。
- 逐级上浮：满足三次原则后只能提取到最近公共父级，只有跨顶级业务域复用才允许进入 `src/` 根级公共目录。
- 类型推导优先：可由现有组件、API 响应、Schema 或常量对象表达的类型，优先从源数据推导，避免重复手写。
- 类型边界：复杂组件如需拆分 Props、Emits、Expose、Ref，可在 `types/` 下按 `props.ts`、`emit.ts`、`expose.ts` 或 `ref.ts`、`index.ts` 组织；简单组件可内联。
- 注释说明 Why over What：核心类型契约、公用工具和难懂实现细节建议写清设计意图、默认值、依赖变化原因、目标和闭包边界。
