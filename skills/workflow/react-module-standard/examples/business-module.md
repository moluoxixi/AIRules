# React 业务模块示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 页面模块

```text
pages/
  purchaseOrder/
    index.tsx
    api/
      index.ts
      purchase-order-api.ts
    components/
      index.ts
      StatusBadge.tsx
      AuditDialog/
        README.md
        index.ts
        src/
          index.tsx
          types/
            props.ts
            ref.ts
            index.ts
    hooks/
      index.ts
      use-purchase-order-form.ts
      use-purchase-order-status.ts
    constants/
      index.ts
      purchase-order-status.ts
    styles/
      index.css
      purchase-order.module.css
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
pages/orderShared/utils/format-order-status.ts
```

当至少三个订单相关模块复用同一格式化逻辑时，上浮到最近公共父级的共享目录。

## Custom Hook 位置判断

```text
purchaseOrder/hooks/use-purchase-order-form.ts
```

该 hook 只服务采购订单表单页面，留在模块内。

```text
pages/orderShared/hooks/use-order-status-flow.ts
```

当至少三个订单模块复用同一状态流转逻辑时，上浮到最近公共父级。

## Context 跨层级通信

```tsx
// purchaseOrder/context/order-form-context.ts
import { createContext, useContext } from 'react'

interface OrderFormContextValue {
  readonly: boolean
  submit: () => Promise<void>
}

const OrderFormContext = createContext<OrderFormContextValue | null>(null)

function useOrderFormContext(): OrderFormContextValue {
  const context = useContext(OrderFormContext)
  if (!context) {
    throw new Error('useOrderFormContext must be used within PurchaseOrderPage')
  }
  return context
}

export { OrderFormContext, useOrderFormContext }
```

```tsx
// purchaseOrder/index.tsx
import { useMemo, useState } from 'react'
import { OrderFormContext } from './context/order-form-context'

function PurchaseOrderPage() {
  const [readonly, setReadonly] = useState(false)
  const submit = async () => { /* ... */ }

  const value = useMemo(() => ({ readonly, submit }), [readonly])

  return (
    <OrderFormContext value={value}>
      {/* ... */}
    </OrderFormContext>
  )
}
```

```tsx
// purchaseOrder/components/AuditDialog/src/index.tsx
import { useOrderFormContext } from '../../../context/order-form-context'

function AuditDialog() {
  const { readonly, submit } = useOrderFormContext()
  // ...
}
```

## 数据获取 Hook 示例

```tsx
// purchaseOrder/hooks/use-purchase-order-detail.ts
import { useEffect, useState } from 'react'
import { fetchPurchaseOrder } from '../api'
import type { PurchaseOrder } from '../types'

function usePurchaseOrderDetail(id: string) {
  const [data, setData] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    fetchPurchaseOrder(id, { signal: controller.signal })
      .then(setData)
      .catch((err) => {
        if (!controller.signal.aborted) setError(err)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [id])

  return { data, loading, error }
}
```
