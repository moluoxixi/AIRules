# 组件库规则

# ===== references/frontend/components.md =====

# 前端外部组件库文档规范

## 触发边界

- 本规范适用于前端项目消费外部组件库、Design System、UI SDK 或 workspace 组件包的场景。
- 当前项目自己的组件库输出不使用本规范；组件库项目对外契约由 `frontend/out-components.md` 和 `components-docs` 输出到 `docs/out-components/`。
- 修改外部组件库依赖版本、封装适配层、主题配置、组件使用约束、表单/弹窗/表格等公共用法，或初始化时发现已有外部组件库文档时，必须触发 `components-docs` 的 consumer mode。

## 输出边界

- 外部组件库消费文档输出到 `docs/components/`，用于约束本项目如何使用依赖组件库。
- 外部组件库官方文档、依赖包自维护文档和本项目已有封装规则优先作为消费事实来源，但必须按 `components-docs` 的输出位置、文档结构、必备字段、来源证据和 `MISSING` 语义做合规校验；不符合 AIRules 要求时必须标准化到 `docs/components/`。AI 必须再读取 `package.json`、lockfile、源码 import、全局注册、主题配置和示例做扫描校验，缺少本项目使用约束时补齐，发现使用方式与上游文档冲突时标记 `MISSING component docs drift`。
- 普通业务组件不得写入 `docs/components/`；无法确认是否属于外部组件库时，先标记 `MISSING component ownership`，不得伪装为已归类。

# ===== references/frontend/out-components.md =====

# 前端组件库输出规范

## 触发边界

- 本规范只适用于 `component-library`、Design System、UI SDK 或对外发布组件的前端包。
- 普通前端应用不注入本规范；业务组件和外部组件库消费文档不写入 `docs/out-components/`。
- 新增、删除、重命名或修改组件库组件，或改变 Props、Events、Slots、Expose、Model、样式 token、主题变量、可访问性、示例用法、导出入口和版本兼容时，必须触发 `components-docs`。

## 输出边界

- 对外组件契约输出到 `docs/out-components/`，用于其它项目、AI 或消费方复用。
- 具体文档结构、字段、示例和写作规则以 `components-docs` 为准，本规则不重复描述。
- 不创建或维护 `docs/components/` 镜像目录；`docs/components/` 只用于当前项目消费外部组件库的规则。已存在的旧组件文档必须先判断 ownership，属于当前组件库源码的转换为 `docs/out-components/`。
- 组件库自维护文档优先作为契约事实来源，但必须按 `components-docs` 的输出位置、文档结构、必备字段、来源证据和 `MISSING` 语义做合规校验；不符合 AIRules 要求时必须标准化到 `docs/out-components/`。AI 必须再阅读组件源码、类型、测试、示例和构建入口做扫描校验，发现文档缺口时补齐，发现文档与源码冲突时标记 `MISSING component docs drift`，不得用扫描结果静默覆盖自维护文档。
- 更新 `docs/out-components/` 时必须维护 `docs/out-components/index.md` 的 `来源快照`；无法确认 commit 或工作区 dirty 时显式标记，不得伪造提交 ID。
