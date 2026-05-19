# 业务模块示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 业务模块

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
          api/
            index.ts
            audit-dialog-api.ts
          composables/
            index.ts
            use-audit-dialog.ts
          types/
            props.ts
            emit.ts
            expose.ts
            index.ts
    composables/
      index.ts
      use-purchase-order.ts
    constants/
      index.ts
      purchase-order-status.ts
    styles/
      index.scss
      purchase-order.scss
    assets/
      index.ts
      empty-state.png
    types/
      index.ts
      purchase-order.ts
    utils/
      index.ts
      format-purchase-order.ts
```
