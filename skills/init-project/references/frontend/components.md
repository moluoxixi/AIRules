---
ruleScope: component-consumer
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.vue"
description: 消费外部组件库、Design System、UI SDK 或 workspace 组件包，需要接入/封装/查文档时遵循
loadTiming: 接入外部组件库前
---
# 前端外部组件库文档规范

## 触发边界

- 本规范适用于前端项目消费外部组件库、Design System、UI SDK 或 workspace 组件包的场景。
- 当前项目自己的组件库输出不使用本规范；组件库项目对外契约由 `frontend/out-components.md` 和 `components-docs` 输出到 `docs/out-components/`。
- 修改外部组件库依赖版本、封装适配层、主题配置、组件使用约束、表单/弹窗/表格等公共用法，或初始化时发现已有外部组件库文档时，必须触发 `components-docs` 的 consumer mode。

## 输出边界

- 外部组件库消费文档输出到 `docs/components/`，用于约束本项目如何使用依赖组件库。
- 外部组件库官方文档、依赖包自维护文档和本项目已有封装规则优先作为消费事实来源，但必须按 `components-docs` 的输出位置、文档结构、必备字段、来源证据和 `MISSING` 语义做合规校验；不符合 AIRules 要求时必须标准化到 `docs/components/`。AI 必须再读取 `package.json`、lockfile、源码 import、全局注册、主题配置和示例做扫描校验，缺少本项目使用约束时补齐，发现使用方式与上游文档冲突时标记 `MISSING component docs drift`。
- 普通业务组件不得写入 `docs/components/`；无法确认是否属于外部组件库时，先标记 `MISSING component ownership`，不得伪装为已归类。
