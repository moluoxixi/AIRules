# 工具包示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

## 简单工具

```text
normalize-text.ts
copy-text.ts
```

局部工具先贴近使用点。只有出现跨模块复用、明确公共 API 或独立测试边界时，才升级为工具包。

## 工具包

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

## 副作用边界

```ts
export interface CopyTextOptions {
  text: string
  navigator: Navigator
}
```

涉及浏览器 API 的工具显式接收依赖，测试时不伪造全局成功。
