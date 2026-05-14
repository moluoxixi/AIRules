---
name: frontend-testing-standard
description: 用于测试、验证或评审前端变更，适用于 UI 行为、组件测试、hooks/composables、浏览器渲染、响应式、可访问性、E2E、构建验证和覆盖率。
---

# 前端测试规范

## 用途

本 Skill 提供前端验证范围的可复用规范，帮助按变更风险选择静态检查、类型检查、单元/组件/页面测试、浏览器检查、可访问性、构建和覆盖率。

项目、用户或 CI 规则更严格时，优先遵循更严格的规则。

## 适用场景

- 前端逻辑、组件、页面、路由、交互、样式、浏览器运行时或构建结果发生变化。
- 需要判断验证范围，而不是默认跑所有测试。
- 需要报告哪些验证已运行、哪些缺失、哪些不相关。

## 读取参考

- 测试维度：读 [test-dimensions.md](references/test-dimensions.md)。
- 命令发现：读 [command-discovery.md](references/command-discovery.md)。
- 浏览器、交互、响应式、视觉和 canvas 检查：读 [browser-verification.md](references/browser-verification.md)。
- 可访问性检查：读 [accessibility.md](references/accessibility.md)。
- 覆盖率和风险：读 [coverage-and-risk.md](references/coverage-and-risk.md)。

## 核心判断

按相关性评估：
- 静态质量；
- 类型正确性；
- 单元逻辑；
- 组件行为；
- 页面或路由集成；
- 关键用户交互；
- 浏览器运行时健康；
- 响应式布局和视觉完整性；
- 可访问性基础；
- 生产构建或等价交付检查；
- 项目有工具且变更包含有意义逻辑时的覆盖率。

如果某维度相关但项目没有工具或入口，可报告 `MISSING`；如果相关但无法运行，可报告 `NOT RUN` 并说明原因；如果与本次任务无关，可报告 `N/A`。

## 关联 Skill

- Vue 测试可结合 `vue-testing-best-practices`。
- Vitest 测试、mock、fixture 和 coverage 可结合 `vitest`。
- Playwright 或浏览器驱动检查可结合 `playwright` 或可用浏览器工具。
- UI 可访问性或视觉质量评审可结合 `web-design-guidelines`。

## 反模式

不要为了通过报告而降低阈值、删除断言、排除关键文件、mock 掉被测行为，或用静态猜测替代失败的浏览器检查。
