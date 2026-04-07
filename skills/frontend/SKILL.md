---
name: frontend
description: Use when 处理页面、组件、交互或状态归属，或需要明确 loading / empty / error 等前端界面状态。
---

# Frontend

## 概述

这个 skill 负责跨框架共享的前端问题，重点是清晰的页面/组件边界、刻意设计的状态放置方式，以及完整的用户交互。

## 何时使用

在任意前端技术栈中实现或审查 UI 行为、页面流程、组件结构时使用。

## 硬约束

1. 每个页面和组件都要有清晰归属，避免职责混杂。
2. 每个异步界面都必须显式处理加载、空态和错误状态。
3. 交互行为必须完整，而不是只做一半：成功、失败、禁用、重试路径都要有明确设计。

## 流程

1. 先划分边界：哪些属于路由/页面层，哪些属于可复用组件层。
2. 把状态放在能满足交互需求的最低层级。
3. 在实现前先定义用户可见的抓取和提交状态流转。
4. 让表单、列表和操作在行为上完整，反馈可预期。
5. 检查基本可访问性：语义、键盘可达性和标签是否齐全。

## 边界

这个 skill 不负责 React hooks、Vue composables、Next/Nuxt 约定等框架特有细节。这些决策交给 framework skills。

## 相关 Skills

- `standard-workflow`
- `javascript`, `typescript`
- `react`, `vue`
- `backend`
- `testing`, `verification`
