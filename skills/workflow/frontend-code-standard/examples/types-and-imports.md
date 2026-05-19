# 类型与导入示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 类型出口

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

## 导入示例

禁止导入：

```ts
import { formatDate } from '../../utils/date'
import { formatDate } from '@/components/DataTable/utils/date'
import { formatDate } from '@/components/DataTable/utils'
import { formatDate } from '../../../utils'
```

允许导入：

```ts
import { formatDate } from '@/components/DataTable'
```
