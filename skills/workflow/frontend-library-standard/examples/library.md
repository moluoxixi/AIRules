# 前端库示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 简单工具

```text
normalize-text.ts
copy-text.ts
```

局部工具先贴近使用点。只有出现跨模块复用、明确公共 API 或独立测试边界时，才升级为工具包。

## 工具库（utility-library）

```text
ClipboardToolkit/
  README.md
  index.ts
  src/
    index.ts
    clipboard/
      index.ts
      api/
        index.ts
        clipboard-api.ts
      constants/
        index.ts
        clipboard-options.ts
      utils/
        index.ts
        normalize-text.ts
        copy-text.ts
    types/
      index.ts
```

### 工具库公共入口示例

```ts
// ClipboardToolkit/index.ts
export { copyText, readText } from './src'
export type { CopyTextOptions, ReadTextOptions } from './src/types'
```

### 工具库 README 示例

```md
# ClipboardToolkit

剪贴板操作工具包。

## 安装

\`\`\`bash
pnpm add @example/clipboard-toolkit
\`\`\`

## 使用

\`\`\`ts
import { copyText } from '@example/clipboard-toolkit'

await copyText({ text: 'Hello', navigator: window.navigator })
\`\`\`

## API

### copyText(options: CopyTextOptions): Promise<void>

复制文本到剪贴板。

### readText(options: ReadTextOptions): Promise<string>

从剪贴板读取文本。

## 约束

- 必须显式传入 `navigator`，不依赖全局对象。
- 不支持 IE 浏览器。
```

## UI 组件库（ui-library）

```text
MoluoxixiUI/
  README.md
  index.ts
  src/
    index.ts
    components/
      index.ts
      Button/
        README.md
        index.ts
        src/
          index.vue
          types/
            index.ts
            props.ts
      DataTable/
        README.md
        index.ts
        src/
          index.vue
          composables/
            index.ts
            use-table-sort.ts
          components/
            index.ts
            HeaderCell.vue
            BodyRow.vue
          types/
            index.ts
            props.ts
            emit.ts
    composables/
      index.ts
      use-theme.ts
    styles/
      index.scss
```

### UI 组件库公共入口示例

```ts
// MoluoxixiUI/index.ts
export { Button } from './src/components/Button'
export { DataTable } from './src/components/DataTable'
export { useTheme } from './src/composables'
export type { ButtonProps } from './src/components/Button'
export type { DataTableProps, DataTableColumn } from './src/components/DataTable'
```

### UI 组件库 README 示例

```md
# MoluoxixiUI

Vue 3 组件库。

## 安装

\`\`\`bash
pnpm add @example/moluoxixi-ui
\`\`\`

## 使用

\`\`\`vue
<script setup lang="ts">
import { Button, DataTable } from '@example/moluoxixi-ui'
import '@example/moluoxixi-ui/styles'
</script>

<template>
  <Button>Click me</Button>
  <DataTable :columns="columns" :data="data" />
</template>
\`\`\`

## 组件

- `Button` - 按钮组件
- `DataTable` - 数据表格组件

## 约束

- 需要 Vue 3.4+
- 样式需单独引入
```

## 副作用边界

```ts
// 涉及浏览器 API 的工具显式接收依赖
export interface CopyTextOptions {
  text: string
  navigator: Navigator
}

export async function copyText(options: CopyTextOptions): Promise<void> {
  const { text, navigator } = options
  await navigator.clipboard.writeText(text)
}
```

涉及浏览器 API 的工具显式接收依赖，测试时不伪造全局成功。

## 禁止模式

```ts
// ❌ 错误：直接依赖全局对象
export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

// ❌ 错误：静默失败
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false // 吞掉错误
  }
}
```
