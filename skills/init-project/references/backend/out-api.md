# 后端 API 输出规范

## 触发边界

- 本规范适用于 HTTP API、GraphQL、RPC、Webhook、消息事件、后端 SDK 或其它向外部调用方暴露契约的后端项目。
- 修改路由、Controller、Resolver、DTO/schema、OpenAPI/Swagger、错误码、鉴权、分页、Headers、版本策略、Webhook、事件契约或 SDK 对外 API 时，必须触发 `api-docs`。
- 领域规则、架构决策、测试策略仍分别交给 `prd-docs`、`architecture-docs`、`test-docs`；本规范只约束 API 对外契约输出。

## 输出边界

- 对外 API 契约输出到 `out-api/`，用于前端、第三方、测试代理或其它服务复用。
- 具体文档结构、字段、示例和写作规则以 `api-docs` 为准，本规则不重复描述。
- 若项目同时维护 `docs/api/`，它只作为项目内部知识库入口；对外交付以 `out-api/` 为准，二者不得出现冲突。
- API 契约事实必须由 AI 阅读后端源码、路由注册、DTO/schema、OpenAPI/Swagger、测试、Mock 和已有文档后推导；不得只依赖脚本或目录名生成正文。
- 更新 `out-api/` 时必须维护 `out-api/index.md` 的 `来源快照`；无法确认 commit 或工作区 dirty 时显式标记，不得伪造提交 ID。
