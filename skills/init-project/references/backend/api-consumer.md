---
ruleScope: backend
globs:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.mjs"
  - "**/*.java"
description: 消费外部 HTTP API、上游服务、SDK 或 generated client，需要接入/封装防腐/查文档时遵循
loadTiming: 接入外部 API/SDK 前
---
# 后端外部 API 消费规范

## 触发边界

- 本规范适用于后端项目消费外部 HTTP/RPC API、上游服务、第三方 SDK、generated client（Feign/gRPC/OpenAPI client）、Webhook 消费或消息订阅的场景。
- 当前项目自己对外提供的 API 契约不使用本规范；提供方契约由 `backend/out-api.md` 和 `api-docs` 的 provider mode 输出到 `docs/out-api/`。
- 修改外部服务调用、SDK/generated client、Feign/gRPC client、Webhook 消费、消息订阅、Mock 上游、环境变量服务地址，或初始化时发现已有外部接口文档时，必须触发 `api-docs` 的 consumer mode。
- 代码层的防腐红线（Infrastructure 封装外部 SDK、禁止外部类型泄漏进 Domain、外部响应在边界处校验）见 `backend/code.md`，本规范只约束消费契约的文档管理与归属边界。

## 输出边界

- 外部 API 消费文档输出到 `docs/api/`，用于约束本项目如何调用外部接口、上游服务或 SDK。
- 外部接口官方文档、上游自维护文档和本项目已有调用封装优先作为消费事实来源，但必须按 `api-docs` 的输出位置、文档结构、必备字段、来源证据和 `MISSING` 语义做合规校验；不符合 AIRules 要求时必须标准化到 `docs/api/`。AI 必须再读取本项目源码中的调用点、client 配置、环境变量服务地址、错误处理、分页/鉴权封装和 Mock 做扫描校验，缺少本项目调用约束时补齐，发现调用方式与上游文档冲突时标记 `MISSING api docs drift`。
- `docs/api/` 不得作为 `docs/out-api/` 的镜像目录；已有接口文档必须先判断 ownership 后再归类。属于当前项目消费的外部接口写入 `docs/api/`，属于当前项目对外提供的接口由 `backend/out-api.md` 处理；无法确认归属时先标记 `MISSING api ownership`，不得伪装为已归类。
- 当前项目消费的外部 API 契约事实必须由 AI 阅读调用源码、client/SDK 定义、环境配置、测试、Mock 和已有文档后推导；不得只依赖脚本或目录名生成正文。
