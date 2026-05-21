# React 模块校验清单

本文件只提供校验脚本用法和检查清单，不定义新规则；规则以 `SKILL.md` 为准。

## 脚本用法

```bash
node skills/workflow/react-module-standard/scripts/verify-rules.mjs
node skills/workflow/react-module-standard/scripts/verify-rules.mjs module --root src/pages/purchaseOrder
node skills/workflow/react-module-standard/scripts/verify-rules.mjs hoist --target src/pages/orderShared/utils --uses src/pages/purchaseOrder/index.tsx src/pages/salesOrder/index.tsx src/pages/refundOrder/index.tsx
```

## 检查清单

1. 是否先确认了模块职责、页面流程、调用方和相邻模块？
   - 未阅读时标记 `NOT RUN`，不得伪装成已完成审查。
2. 目标类型是否判断清楚：`business-module` 还是 `ordinary-module`？
   - 分类不确定时说明候选分类和分歧原因。
3. 当前结构是否还保留了只为兼容旧路径存在的中间层目录、双出口或伪共享目录？
   - 若存在，标记 `FAIL`，指出具体文件并给出删除或重建建议。
4. React 版本相关 API 是否正确使用？
   - React 18：ref 转发需使用 `forwardRef`；Context 需使用 `<Context.Provider>`。
   - React 19+：ref 可直接作为 prop 接收；Context 可直接作为 provider 使用。
   - 若版本不匹配，标记 `FAIL`，指出具体 API 和建议的调整方式。
5. 状态是否就近保留，没有无依据上浮到 Context、外部 store 或 custom hook？
   - 若不符合，标记 `FAIL`，说明当前状态为何不应上浮，以及建议回收到哪个文件或模块边界。
6. 公共代码抽离是否满足三次原则，并落在最近公共父级？
   - 若不符合，标记 `FAIL`，说明当前使用点数量、错误上浮位置，以及建议保留或迁移到哪个共享目录。
7. 入口是否唯一，且模块根目录是否错误创建了包级公共入口？
   - 可配合 `verify-rules.mjs` 校验结构；脚本 `PASS` 只代表结构通过，不代表实现整体通过。
8. 是否没有 deep import、穿透私有目录或伪共享层？
   - 若不符合，标记 `FAIL`，必须给出具体 import 语句、文件位置和应改用的公开入口或正确位置。
9. Custom hooks 是否遵循 hooks 规则？
   - hooks 只在组件顶层调用，不在条件、循环或嵌套函数中调用。
   - `useEffect` 是否有清理函数处理取消订阅和 abort。
   - 若不符合，标记 `FAIL`，指出具体 hook 和问题。
10. Context 使用是否合理？
    - Context 只用于跨层级共享不频繁变化的数据。
    - 频繁变化的状态不放 Context。
    - Context value 是否使用 `useMemo` 稳定引用。
    - 若不符合，标记 `FAIL`，说明问题和建议的改进方式。
11. 是否运行了与风险匹配的现有 lint、tsc、test、build 或浏览器验证？
    - 缺少脚本或依赖时标记 `MISSING`，未执行标记 `NOT RUN`，失败标记 `FAIL`。

## 评审输出最低要求

- 先写目标分类和本次检查范围。
- 给出总结论：`PASS`、`FAIL`、`MISSING` 或 `NOT RUN`。
- 每个问题都要包含：规则点、证据（文件路径和位置）、问题说明、可执行的改动建议。
- 改动建议必须能直接交给其他 AI 实现，不得只写"建议优化""建议调整""建议规范化"。
