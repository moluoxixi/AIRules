# 后端规则

# ===== references/backend/out-api.md =====

# 后端 API 契约文档规范

## 触发边界

- 本规范适用于 HTTP API、GraphQL、RPC、Webhook、消息事件、后端 SDK 或其它向外部调用方暴露契约的后端项目。
- 修改路由、Controller、Resolver、DTO/schema、OpenAPI/Swagger、错误码、鉴权、分页、Headers、版本策略、Webhook、事件契约或 SDK 对外 API 时，必须触发 `api-docs` 的 provider mode。
- 修改外部服务调用、SDK/generated client、Feign/gRPC client、Webhook 消费、消息订阅、Mock 上游、环境变量服务地址或已有外部接口文档时，必须触发 `api-docs` 的 consumer mode。
- 领域规则、架构决策、测试策略仍分别交给 `prd-docs`、`architecture-docs`、`test-docs`；本规范只约束 API 对外契约输出。

## 输出边界

- 当前项目提供的 API 契约输出到 `docs/out-api/`，用于前端、第三方、测试代理或其它服务复用。
- 当前项目消费的外部 API、上游服务、SDK 或 generated client 契约输出到 `docs/api/`，用于约束本项目调用外部接口。
- 具体文档结构、字段、示例和写作规则以 `api-docs` 为准，本规则不重复描述。
- `docs/api/` 不得作为 `docs/out-api/` 的镜像目录；已有接口文档必须先判断 ownership 后再转换。
- API 契约事实必须由 AI 阅读后端源码、路由注册、DTO/schema、OpenAPI/Swagger、测试、Mock 和已有文档后推导；不得只依赖脚本或目录名生成正文。
- 更新 `docs/out-api/` 时必须维护 `docs/out-api/index.md` 的 `来源快照`；无法确认 commit 或工作区 dirty 时显式标记，不得伪造提交 ID。
