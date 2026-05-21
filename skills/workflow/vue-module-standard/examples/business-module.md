# Vue 业务模块示例

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
    composables/
      index.ts
      use-purchase-order-form.ts
      use-purchase-order-status.ts
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

## Composable 位置判断

```text
purchaseOrder/composables/use-purchase-order-form.ts
```

该 composable 只服务采购订单表单页面，留在模块内。

```text
views/orderShared/composables/use-order-status-flow.ts
```

当至少三个订单模块复用同一状态流转逻辑时，上浮到最近公共父级。

## provide/inject 跨层级通信

```vue
<!-- purchaseOrder/index.vue -->
<script setup lang="ts">
import { provide } from 'vue'
import type { InjectionKey, Ref } from 'vue'

export interface OrderFormContext {
  readonly: Ref<boolean>
  submit: () => Promise<void>
}

export const ORDER_FORM_KEY: InjectionKey<OrderFormContext> = Symbol('OrderFormContext')

const readonly = ref(false)
const submit = async () => { /* ... */ }

provide(ORDER_FORM_KEY, { readonly, submit })
</script>
```

```vue
<!-- purchaseOrder/components/AuditDialog/src/index.vue -->
<script setup lang="ts">
import { inject } from 'vue'
import { ORDER_FORM_KEY } from '../../../index.vue'

const context = inject(ORDER_FORM_KEY)
if (!context) {
  throw new Error('AuditDialog must be used within purchaseOrder page')
}
</script>
```
