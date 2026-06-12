# 仓网项目 API 契约（伪装 / 测试用）

> ⚠️ 本文件为全链路文档测试**伪装**的接口契约，非真实后端产物。仅用于驱动 `api-docs` 与 `backend-impl-plan` 的下游测试，不代表真实接口实现。
> 来源：依据 `docs/other/仓网.md` 6 个业务域中需后端支撑的能力反向拟造。
> 协议：REST / JSON，统一返回包 `{ code, message, data }`，鉴权 Header `Authorization: Bearer <token>`（凭证以配置项引用，不写明文）。
> 未定事实统一标 `MISSING`，下游文档不得臆造补全。

## 通用约定

- BaseURL：`/api/wms`（MISSING：网关前缀与版本策略待确认）。
- 分页入参：`pageNo`(从1起)、`pageSize`(默认20)。返回 `{ list, total, pageNo, pageSize }`。
- 错误码：`0` 成功；`40001` 参数校验失败；`40301` 无权限；`40401` 资源不存在；`50001` 服务内部错误；业务错误码见各接口（部分 `MISSING`）。
- 时间字段统一 ISO8601 字符串。

## 1. 基础主数据（仓库 / 区域）

### 1.1 查询仓库列表
- `GET /api/wms/warehouse/list`
- Query：`warehouseName?`、`warehouseCode?`、`pageNo`、`pageSize`
- Resp.data：`{ list: Warehouse[], total }`
- `Warehouse`: `{ id, warehouseCode, warehouseName, areaCode, status }`

### 1.2 查询区域列表
- `GET /api/wms/area/list`
- Query：`areaName?`、`areaCode?`、`pageNo`、`pageSize`
- Resp.data：`{ list: Area[], total }`
- `Area`: `{ id, areaCode, areaName, parentAreaCode? }`（MISSING：区域层级深度上限）

## 2. 供应商发货点管理（新增）

### 2.1 新建发货点
- `POST /api/wms/supplier-shipping`
- Body：`{ supplierId, address, longitude?, latitude?, contact? }`
- 校验：`supplierId` 必填；`address` 必填，触发高德地理编码解析经纬度
- Resp.data：`{ id }`
- 业务错误码：`MISSING`（高德解析失败错误码待确认）

### 2.2 删除发货点
- `DELETE /api/wms/supplier-shipping/{id}`
- 业务规则：`MISSING`（是否因关联供货路由而阻断删除待确认）

## 3. 店仓关系（优化）

### 3.1 查询店仓关系
- `GET /api/wms/store-warehouse/list`
- Query：`storeCode?`、`warehouseCode?`、`pageNo`、`pageSize`
- Resp.data：`{ list: StoreWarehouseRel[], total }`
- `StoreWarehouseRel`: `{ id, storeCode, storeName, warehouseCode, warehouseName, priority }`

### 3.2 维护店仓优先级
- `PUT /api/wms/store-warehouse/{id}/priority`
- Body：`{ priority }`（MISSING：优先级取值范围与唯一性约束）

## 4. 品仓管理（新增）

### 4.1 查询品仓列表
- `GET /api/wms/product-warehouse/list`
- Query：`productKeyword?`(名称/编码)、`warehouseKeyword?`、`storageAttr?`(枚举:storage|crossdock)、`creator?`、`createTimeStart?`、`createTimeEnd?`、`pageNo`、`pageSize`
- 排序：存储属性为空(null)的数据优先展示
- Resp.data：`{ list: ProductWarehouse[], total }`
- `ProductWarehouse`: `{ id, productCode, productName, warehouseCode, warehouseName, storageAttr: 'storage'|'crossdock'|null, creator, createTime }`

### 4.2 批量编辑存储属性
- `PUT /api/wms/product-warehouse/batch-storage-attr`
- Body：`{ ids: number[], storageAttr: 'storage'|'crossdock' }`
- 校验：勾选记录存储属性必须一致，否则返回业务错误（提示「已勾选记录存储属性不一致，请重新选择！」）
- 业务错误码：`MISSING`

### 4.3 查询受影响供货路由数量
- `GET /api/wms/product-warehouse/affected-route-count`
- Query：`productCode`、`warehouseCode`
- 口径：商品=操作记录商品编码，且供货路由明细中任一终点=操作记录仓库编码
- Resp.data：`{ count }`

## 5. 仓仓线路管理（优化）

### 5.1 查询仓仓线路
- `GET /api/wms/warehouse-route/list`
- Query：`fromWarehouseCode?`、`toWarehouseCode?`、`pageNo`、`pageSize`
- Resp.data：`{ list: WarehouseRoute[], total }`
- `WarehouseRoute`: `{ id, fromWarehouseCode, toWarehouseCode, enabled, leadTime? }`（MISSING：时效 leadTime 单位与来源）

## 6. 供应商供货管理（品商仓）

### 6.1 查询供货关系
- `GET /api/wms/supplier-supply/list`
- Query：`supplierCode?`、`productCode?`、`warehouseCode?`、`pageNo`、`pageSize`
- Resp.data：`{ list: SupplierSupply[], total }`
- `SupplierSupply`: `{ id, supplierCode, productCode, warehouseCode, status }`

## 7. 多级供货网络路由

### 7.1 生成 / 查询供货路由
- `GET /api/wms/supply-route/list`
- Query：`productCode?`、`destinationCode?`、`pageNo`、`pageSize`
- Resp.data：`{ list: SupplyRoute[], total }`
- `SupplyRoute`: `{ id, productCode, nodes: RouteNode[], status }`
- `RouteNode`: `{ seq, nodeType, nodeCode }`
- 业务规则：`MISSING`（多级路由生成算法、异常路由处理、与品仓越库变更的联动策略均待确认）

## 全局 MISSING 清单

- 鉴权细节、token 刷新、权限点编码全部 `MISSING`。
- 各业务错误码大量 `MISSING`，下游不得编造。
- 多级供货路由的生成算法与状态机 `MISSING`。
- 数据一致性 / 事务边界（如批量编辑跨表）`MISSING`。
