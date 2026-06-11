---
name: api-docs
description: 用于生成或更新 API 提供方 docs/out-api 或 API 消费方 docs/api 文档，尤其是后端接口、外部服务依赖、联调、OpenAPI/Swagger、错误码、Mock 数据或请求响应示例需要落文档时触发。
---

# API Docs

## 触发条件

- 用户要求生成、更新或标准化 API 提供方/消费方文档时使用。
- 代码、OpenAPI、外部 client、Mock、联调记录或已有接口文档需要沉淀为可审计契约时使用。

## 不适合场景

- 只需要实现或调试接口代码，不需要落文档时不要使用。
- 无法确认接口归属、来源或契约事实时，不要猜测；标记 `MISSING` 并说明缺口。

## 输出边界

- 只写 `docs/api/`、`docs/out-api/`、对应索引和 `docs/map.md`。
- 不修改接口实现、全局协议设计、业务需求或第三方/vendor 文档；这些变更需要用户另行确认。

## 输出位置

- 提供方文档：`docs/out-api/<业务域>.md`
- 提供方索引：`docs/out-api/index.md`
- 提供方全局协议：`docs/out-api/_protocol.md`
- 消费方文档：`docs/api/<外部服务或业务域>.md`
- 消费方索引：`docs/api/index.md`
- 消费方协议：`docs/api/_protocol.md`
- 地图路径：`docs/map.md`
- `docs/out-api/` 是当前项目作为后端、服务或 SDK 提供给外部调用方复用的 API 契约。
- `docs/api/` 是当前项目调用外部服务、第三方 API、上游系统、OpenAPI generated client 或 SDK 时的消费方接口知识库；不得作为 `docs/out-api/` 镜像目录。

## 模式选择

- Provider mode：当前项目或 monorepo 子项目暴露 HTTP API、GraphQL、RPC、Webhook、消息事件或后端 SDK 时启用；输出当前项目自己的接口到 `docs/out-api/`。
- Consumer mode：当前项目调用外部 HTTP API、GraphQL、RPC、Webhook、消息系统、SDK、generated client 或其它服务时启用；输出本项目依赖的外部接口到 `docs/api/`。
- 同一仓库可以同时存在 provider mode 与 consumer mode；必须按接口归属分别处理，不得把当前项目自己的接口写入 `docs/api/` 作为对外契约。
- 已有接口文档必须先判定归属：能匹配当前项目路由、Controller、Resolver、DTO/schema、OpenAPI/Swagger 或测试的，转为 `docs/out-api/`；能匹配外部 baseURL、SDK 依赖、generated client、Feign/gRPC client、Mock 上游或环境变量服务地址的，转为 `docs/api/`；无法确认时标记 `MISSING API ownership` 并保留来源路径。

## 写作规则

- 先读取已存在的 `docs/map.md`、`docs/api/index.md`、`docs/api/_protocol.md`、`docs/out-api/index.md`、`docs/out-api/_protocol.md`、相关 PRD、架构文档、路由源码、外部 client 源码和已有接口文档；目标目录或索引不存在时创建，不得因缺失停止。
- 接口事实优先来自后端路由、OpenAPI/Swagger、接口实现或用户提供的契约；无法确认时标记 `MISSING`。
- 变更分级（L0/L1/L2）与澄清门禁的统一定义见项目 `AGENTS.md` 的「变更分级与确认门禁」「澄清门禁」两节；本 skill 的分级判定以该定义为准。
- 命中澄清门禁时（接口归属、全局协议、鉴权、错误码、分页、请求响应语义、Mock 数据或联调边界缺少明确来源或存在歧义），必须先输出《接口契约澄清问题清单》，用苏格拉底式问题逐项暴露调用目标、消费者/提供方边界、字段语义、异常语义、兼容性、幂等性和安全风险；未确认内容必须标记为 `MISSING`，澄清未闭环前不得定稿。
- 每个接口必须包含请求方法、路径、用途、请求参数、响应结构、错误码和联调注意事项。
- 当前项目对外提供的全局返回结构、错误结构、分页、鉴权、Headers、版本策略只维护在 `docs/out-api/_protocol.md`。
- 当前项目调用外部服务时依赖的上游协议、鉴权、Headers、分页、错误结构和偏差记录维护在 `docs/api/_protocol.md` 或对应外部服务文档中。
- 根据已有后端源码、OpenAPI/Swagger、DTO/schema、测试或 Mock 生成或更新 `docs/out-api/` 是实时对外输出，属于 L0/L1，不属于 L2，不得先输出报告等待确认，也不得以评审门槛为由跳过；但接口归属或契约事实缺失时仍须按澄清门禁标记 `MISSING`。
- 根据已有外部 client、SDK 依赖、generated client、OpenAPI 文件、Mock 或旧文档生成 `docs/api/` 是消费方知识整理，属于 L0/L1，不属于 L2，不得先输出报告等待确认。
- 源码、契约、测试或已有文档无法确认的信息，必须在对应 API 文档中标记 `MISSING` 并说明缺口。
- 只有用户要求修改接口代码、重新设计全局协议、错误码体系、分页策略、鉴权策略或跨业务接口拆分时，才进入代码实现或协议设计评审；评审不得阻塞本 skill 对已存在源码事实的文档输出。
- 更新或新增提供方文档后，同步更新 `docs/out-api/index.md` 的接口清单和 `来源快照`。
- 更新或新增消费方文档后，同步更新 `docs/api/index.md` 的外部服务清单、来源证据和 `docs/map.md`。
- `来源快照` 记录在 `docs/out-api/index.md`，包含 `sourceCommit`、`sourceState`、`generatedBy`、`sourceRoots` 和关键 `sourceFiles`。
- 工作区 clean 且 Git 可用时，`sourceCommit` 使用当前 `HEAD`；工作区 dirty 或无法确认提交时，必须标记 `sourceState: dirty` 或 `MISSING source commit`，并列出影响本次文档的已修改源码文件。
- 单个 API 文档只记录路由、Controller/Resolver、DTO/schema、OpenAPI/Swagger、测试和 Mock 来源，不重复记录 commit ID。

## 全局协议结构

```md
# 全局接口协议

## 适用范围

## 成功响应

## 列表分页

## 错误响应

## 鉴权与 Headers

## 版本策略

## 协议偏差

## 待确认
```

## 文档结构

```md
# <业务域>接口文档

## 来源

## 接口清单

| 方法 | 路径 | 用途 | 状态 |
|---|---|---|---|

## <接口名称>

### 请求

### 参数

### 响应

### 错误码

### 联调说明

### 协议偏差

## Mock 与测试数据

## 待确认
```

## 示例

以下内容是示例模板，仅供参考，不得作为真实业务事实自动应用。

````md
# 采购订单接口文档

## 来源

- PRD：`docs/prds/采购订单.md`
- 后端路由：`PurchaseOrderController`

## 接口清单

| 方法 | 路径 | 用途 | 状态 |
|---|---|---|---|
| GET | `/api/purchase-orders` | 查询采购订单列表 | confirmed |

## 查询采购订单列表

### 请求

`GET /api/purchase-orders`

### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| supplierName | query | string | 否 | 供应商名称，支持模糊查询 |
| status | query | string | 否 | 订单状态 |

### 响应

```json
{
  "items": [
    {
      "id": "po_001",
      "orderNo": "PO20260101001",
      "supplierName": "华东供应商",
      "status": "approved"
    }
  ],
  "total": 1
}
```

### 错误码

| 状态码 | code | 说明 |
|---|---|---|
| 400 | INVALID_STATUS | 状态值不合法 |

### 联调说明

- 前端列表筛选字段与 query 参数一一对应。
- MISSING：分页参数默认值以后端确认为准。
````
