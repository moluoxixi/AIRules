---
name: vue
description: Use when 任务涉及 Vue / Nuxt 的 .vue 文件、composables、store、页面数据流或响应式状态归属。
---

# Vue

## Overview

这个 skill 在 `frontend` 和 `typescript` 之上补充 Vue / Nuxt 的具体判断，重点是 composables、store 边界、模板可读性和数据流。

## Quick Reference

- 先继承 `frontend` 的边界，再继承 `typescript` 的契约
- composables 要聚焦、可复用
- store 只在确有共享状态时使用
- 页面和组件里的异步数据都要显式处理加载、空态和错误状态
- 模板保持可读，复杂逻辑挪出模板

## Common Mistakes

- 用 store 兜所有状态，导致归属模糊
- 用 `watch` 做本该交给 `computed` 的派生逻辑
- 模板里塞入过多复杂逻辑

## Related Skills

- `standard-workflow`
- `frontend`
- `typescript`
- `testing`
- `verification`
