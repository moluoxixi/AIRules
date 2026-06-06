# 前端组件库输出规范

## 触发边界

- 本规范只适用于 `component-library`、Design System、UI SDK 或对外发布组件的前端包。
- 普通前端应用不注入本规范；业务组件不写入 `out-components/`。
- 新增、删除、重命名或修改组件库组件，或改变 Props、Events、Slots、Expose、Model、样式 token、主题变量、可访问性、示例用法、导出入口和版本兼容时，必须触发 `components-docs`。

## 输出边界

- 对外组件契约输出到 `out-components/`，用于其它项目、AI 或消费方复用。
- 具体文档结构、字段、示例和写作规则以 `components-docs` 为准，本规则不重复描述。
- 若项目同时维护 `docs/components/`，它只作为项目内部知识库入口；对外交付以 `out-components/` 为准，二者不得出现冲突。
- 组件契约事实必须由 AI 阅读组件源码、类型、测试、示例、构建入口和已有文档后推导；脚本只能辅助发现候选组件。
