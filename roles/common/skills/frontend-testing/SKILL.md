---
name: frontend-testing
description: 当前端 UI、页面、组件、交互流程、表单、权限态或响应式行为发生变化时触发。用于把前端需求转成测试矩阵，并用项目已有测试工具与 Playwright/gstack QA 形成可复核验证证据。
---

# Frontend Testing Gate

前端测试不是“完成后看一眼页面”，而是编码前先列测试矩阵，编码后用真实命令和浏览器证据验证。没有足够文档、接口或测试工具时，标 `MISSING blocked` 或 `NOT RUN`，不得把猜测写成通过。

## 输入

- PRD、story、acceptance criteria、edge cases 或开发侧 `intake.md`。
- `plan.md` 的 `Frontend Planning Notes`。
- 当前项目已有测试脚本、测试框架、组件库、路由和接口契约。

## 测试矩阵

前端任务必须覆盖这些维度；不适用项写 `N/A`，缺关键事实写 `MISSING blocked`：

| 维度 | 必查内容 |
|---|---|
| 页面/路由 | 入口、退出、导航、刷新、深链、权限跳转 |
| 字段 | 字段来源、展示形式、格式化、空值、接口是否提供 |
| 组件 | 复用组件、新封装组件、输入控件、状态组件 |
| 状态 | loading、empty、error、disabled、success、permission-denied、pending |
| 交互 | 点击、输入、提交、取消、重试、分页、筛选、排序 |
| 响应式 | 至少桌面与移动视口；复杂页面补 tablet |
| 可观测错误 | console error、network error、请求状态、异常提示 |
| 回归证据 | 单测/组件测试/E2E/截图/日志的具体命令与输出 |

## 工具选择

优先使用项目已有工具，不擅自引入新测试框架。

- 组件/组合逻辑：Vitest、Jest、Testing Library、Vue Test Utils、React Testing Library 等项目已有栈。
- 真实浏览器流程：Playwright、Cypress、gstack `qa-only` 或项目已有 E2E 工具。
- 视觉/响应式 smoke：Playwright screenshot 或 gstack `design-review`/`qa-only` 的报告模式。

如果项目没有对应测试工具：

1. 标 `MISSING blocked: no frontend test runner`。
2. 给出最小安装建议，但不在未获确认时改依赖。
3. 可运行手动浏览器 smoke，但状态必须写 `NOT RUN automated`，不能伪装为自动化覆盖。

## 输出契约

在 `plan.md` 或验证报告中留下：

- 测试矩阵行。
- 实际命令。
- 退出状态。
- 关键截图或日志路径。
- console/network 检查结论。
- 未执行项和原因。

前端 UI 改动若没有测试矩阵和至少一个真实验证证据，不得标记完成。
