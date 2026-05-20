# 评审输出示例

本文件只提供示例，不定义新规则；规则以 `SKILL.md` 为准。

本示例强调：改动建议必须具体到文件和落点，不得只写“建议优化”“建议调整”“建议规范化”这类空泛建议。

## 组件评审示例

```md
目标分类：component-package
检查范围：已检查 `src/components/DataTable/index.ts`、`src/components/DataTable/src/types/props.ts`、`src/views/order/index.vue`
总结论：FAIL

1. [major] 公共类型未经过公开入口
- 规则点：根入口只暴露稳定公共 API；外部不得 deep import 私有实现
- 证据：`src/views/order/index.vue:12` 直接从 `@/components/DataTable/src/types/props` 导入 `DataTableProps`
- 问题说明：调用方穿透组件内部 `src/`，使类型契约依赖私有实现路径，后续组件内部调整会直接破坏调用方。
- 改动建议：
  1. 在 `src/components/DataTable/index.ts` 补充 `export type { DataTableProps } from './src/types/props'`
  2. 将 `src/views/order/index.vue:12` 改为从 `@/components/DataTable` 导入 `type DataTableProps`

2. [minor] loading 状态只影响按钮文案，没有阻断重复提交
- 规则点：交互组件必须覆盖当前职责下真实存在的 loading、disabled 等状态
- 证据：`src/components/DataTable/src/index.vue:48-67` 在 `loading` 为 `true` 时仍允许触发分页和刷新动作
- 问题说明：当前组件暴露了刷新和翻页交互，loading 期间继续触发会制造并发请求和状态抖动。
- 改动建议：
  1. 在 `src/components/DataTable/src/index.vue` 为刷新按钮和分页操作补充 `disabled={loading}` 或等价禁用条件
  2. 若视觉上仍需可点击反馈，保留焦点但阻断事件分发，并同步更新 loading 态样式

改动建议汇总：
- `src/components/DataTable/index.ts`
  - 暴露 `DataTableProps` 的 type-only 导出
- `src/views/order/index.vue`
  - 将 `@/components/DataTable/src/types/props` 改为 `@/components/DataTable`
- `src/components/DataTable/src/index.vue`
  - 补齐 loading 期间的交互禁用边界
```

## 工具包评审示例

```md
目标分类：utility-library
检查范围：已检查 `packages/ClipboardToolkit/index.ts`、`packages/ClipboardToolkit/src/clipboard/api/clipboard-api.ts`
总结论：FAIL

1. [major] 浏览器依赖被写死在实现内部
- 规则点：涉及浏览器 API 的工具显式表达副作用
- 证据：`packages/ClipboardToolkit/src/clipboard/api/clipboard-api.ts:6-18` 直接读取 `window.navigator.clipboard`
- 问题说明：当前实现把浏览器环境假设写死在工具内部，测试和非浏览器运行时无法按契约提供依赖。
- 改动建议：
  1. 将 `navigator.clipboard` 改为由调用方通过参数传入
  2. 在 `packages/ClipboardToolkit/index.ts` 保持稳定导出，不要把浏览器对象暴露成公共常量

改动建议汇总：
- `packages/ClipboardToolkit/src/clipboard/api/clipboard-api.ts`
  - 改为显式接收 `Clipboard` 或 `Navigator` 依赖
- `packages/ClipboardToolkit/index.ts`
  - 只暴露稳定函数签名，不暴露环境实现细节
```
