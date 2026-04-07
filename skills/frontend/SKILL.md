---
name: frontend
description: Use when 处理页面、组件、交互或状态归属，或需要明确 loading / empty / error 等前端界面状态。
---

# Frontend

## Overview

这个 skill 处理跨框架的前端共性问题，关注点是页面和组件边界、状态归属，以及用户交互是否完整。

它不负责框架特有细节，React hooks、Vue composables、Next/Nuxt 约定应交给对应 framework skills。

## Quick Reference

- 先划清页面和组件边界
- 状态放在满足需求的最低层级
- 加载、空态和错误状态必须显式出现
- 交互行为必须完整，成功、失败、禁用、重试都要可预期
- 不要让框架特有细节污染跨框架层

## Common Mistakes

- 页面和组件职责混杂
- 只做成功路径，不补空态和异常态
- 明明是框架特有问题，却还停留在跨框架层面讨论

## Related Skills

- `standard-workflow`
- `javascript`, `typescript`
- `react`, `vue`
- `backend`
- `testing`, `verification`
