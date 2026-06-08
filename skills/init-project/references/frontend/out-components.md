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
