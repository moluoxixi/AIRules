# 业务模块示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 页面模块

```text
views/
  purchaseOrder/
    index.vue
    api/
      index.ts
      purchase-order-api.ts
    components/
      index.ts
      StatusBadge.vue
      AuditDialog/
        README.md
        index.ts
        src/
          index.vue
          types/
            props.ts
            emit.ts
            index.ts
    constants/
      index.ts
      purchase-order-status.ts
    styles/
      index.scss
      purchase-order.scss
    types/
      index.ts
      purchase-order.ts
    utils/
      index.ts
      format-purchase-order.ts
```

## 位置判断

```text
purchaseOrder/utils/format-purchase-order.ts
```

该工具只服务采购订单模块，留在模块内。

```text
views/orderShared/utils/format-order-status.ts
```

当至少三个订单相关模块复用同一格式化逻辑时，上浮到最近公共父级的共享目录。
