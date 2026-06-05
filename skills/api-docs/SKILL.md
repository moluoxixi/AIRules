---
name: api-docs
description: 用于生成或更新 docs/api 下的接口文档，尤其是前后端联调、OpenAPI/Swagger 补充、接口契约、错误码、Mock 数据或请求响应示例需要落文档时触发。
---

# API Docs

## 输出位置

- 文档路径：`docs/api/<业务域>.md`
- 索引路径：`docs/api/index.md`
- 全局协议：`docs/api/_protocol.md`
- 地图路径：`docs/map.md`

## 写作规则

- 先读取 `docs/map.md`、`docs/api/index.md`、`docs/api/_protocol.md`、相关 PRD、架构文档和已有接口文档。
- 接口事实优先来自后端路由、OpenAPI/Swagger、接口实现或用户提供的契约；无法确认时标记 `MISSING`。
- 每个接口必须包含请求方法、路径、用途、请求参数、响应结构、错误码和联调注意事项。
- 全局返回结构、错误结构、分页、鉴权、Headers、版本策略只维护在 `docs/api/_protocol.md`；业务接口文档只能引用或声明协议偏差。
- 新增或修改全局接口协议、错误码体系、分页策略、鉴权策略或跨业务接口拆分时，属于 L2，必须先输出《接口协议与文档拆分报告》并等待开发者确认。
- 更新或新增文档后，同步更新 `docs/api/index.md` 和 `docs/map.md`；`docs/map.md` 必须维护业务域到 PRD/API/组件/测试文档的导航关系。

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
