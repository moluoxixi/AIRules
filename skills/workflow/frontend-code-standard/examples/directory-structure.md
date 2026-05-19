# 前端结构示例

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

## 简单组件

```text
components/
  StatusBadge.vue
  InlineChart.tsx
  Sparkline.jsx
  UserAvatar.vue
```

## 复杂组件

```text
DataTable/
  README.md
  index.ts
  src/
    index.vue
    types/
      props.ts
      emit.ts
      expose.ts
      index.ts
```

## 工具库

```text
BrowserToolkit/
  README.md
  index.ts
  src/
    index.ts
    clipboard/
      index.ts
      types/
        index.ts
    storage/
      index.ts
```

## UI 组件库

```text
MoluoxixiUI/
  README.md
  index.ts
  src/
    index.ts
    components/
      index.ts
      DataTable/
        README.md
        index.ts
        src/
          index.vue
```

## 类型与导入

Vue 类型出口：

```ts
export type * from './props'
export type * from './expose'
export type * from './emit'
```

React 类型结构：

```text
DataTable/
  index.ts
  src/
    index.tsx
    types/
      props.ts
      ref.ts
      index.ts
```

```ts
export type * from './props'
export type * from './ref'
```

禁止导入：

```ts
import { formatDate } from '../../utils/date'
import { formatDate } from '@/components/DataTable/utils/date'
import { formatDate } from '@/components/DataTable/utils'
```

允许导入：

```ts
import { formatDate } from '@/components/DataTable'
```
