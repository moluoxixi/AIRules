# 前端外部组件库文档规范

## 触发边界

- 本规范适用于前端项目消费外部组件库、Design System、UI SDK 或 workspace 组件包的场景。
- 当前项目自己的组件库输出不使用本规范；组件库项目对外契约由 `frontend/out-components.md` 和 `components-docs` 输出到 `docs/out-components/`。
- 修改外部组件库依赖版本、封装适配层、主题配置、组件使用约束、表单/弹窗/表格等公共用法，或初始化时发现已有外部组件库文档时，必须触发 `components-docs` 的 consumer mode。

## 输出边界

- 外部组件库消费文档输出到 `docs/components/`，用于约束本项目如何使用依赖组件库。
- 组件消费事实必须由 AI 读取 `package.json`、lockfile、源码 import、全局注册、主题配置、已有文档和示例后推导；不得只凭目录名生成正文。
- 普通业务组件不得写入 `docs/components/`；无法确认是否属于外部组件库时，先标记 `MISSING component ownership`，不得伪装为已归类。
