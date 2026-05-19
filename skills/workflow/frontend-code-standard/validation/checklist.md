# 前端校验清单

本文件只提供校验脚本用法和检查清单，不定义新规则；规则以 `SKILL.md` 为准。

## 脚本用法

```bash
node skills/workflow/frontend-code-standard/scripts/verify-rules.mjs
node skills/workflow/frontend-code-standard/scripts/verify-rules.mjs module --root src/views/purchaseOrder
node skills/workflow/frontend-code-standard/scripts/verify-rules.mjs simple-component --root src/components/StatusBadge.vue
node skills/workflow/frontend-code-standard/scripts/verify-rules.mjs component --root src/components/DataTable
node skills/workflow/frontend-code-standard/scripts/verify-rules.mjs utility --root packages/BrowserToolkit
node skills/workflow/frontend-code-standard/scripts/verify-rules.mjs ui-library --root packages/MoluoxixiUI
node skills/workflow/frontend-code-standard/scripts/verify-rules.mjs hoist --target src/views/purchaseOrder/utils --uses src/views/purchaseOrder/create/index.vue src/views/purchaseOrder/update/index.vue src/views/purchaseOrder/detail/index.vue
```

## 检查清单

1. 入口是否唯一，且入口形态是否符合 `SKILL.md`？
2. 子目录是否按需创建，没有空目录和装饰性拆分？
3. `styles/` 是否只使用 `index.css` / `.scss` / `.less`？
4. 复杂组件、工具库、UI 组件库是否阻止外部穿透 `src/`？
5. 已拆分类型是否优先从源数据推导，避免复制手写？
6. 抽离是否满足三次原则，并落在最近公共父级？
7. 跨模块或多层路径是否优先使用路径别名？
8. 目录拆分是否服务真实边界，没有为形式化拆分创建空目录或装饰性层级？
