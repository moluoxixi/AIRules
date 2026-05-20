# 前端模块校验清单

本文件只提供校验脚本用法和检查清单，不定义新规则；规则以 `SKILL.md` 为准。

## 脚本用法

```bash
node skills/workflow/frontend-module-standard/scripts/verify-rules.mjs
node skills/workflow/frontend-module-standard/scripts/verify-rules.mjs module --root src/views/purchaseOrder
node skills/workflow/frontend-module-standard/scripts/verify-rules.mjs hoist --target src/views/orderShared/utils --uses src/views/purchaseOrder/index.vue src/views/salesOrder/index.vue src/views/refundOrder/index.vue
```

## 检查清单

1. 是否先确认了模块职责、页面流程、调用方和相邻模块？
   - 未阅读时标记 `NOT RUN`，不得伪装成已完成审查。
2. 目标类型是否判断清楚：`business-module` 还是 `ordinary-module`？
   - 分类不确定时说明候选分类和分歧原因。
3. 当前结构是否还保留了只为兼容旧路径存在的中间层目录、双出口或伪共享目录？
   - 若存在，标记 `FAIL`，指出具体文件并给出删除或重建建议。
4. 状态是否就近保留，没有无依据上浮到 store、context、hook 或 composable？
   - 若不符合，标记 `FAIL`，说明当前状态为何不应上浮，以及建议回收到哪个文件或模块边界。
5. 公共代码抽离是否满足三次原则，并落在最近公共父级？
   - 若不符合，标记 `FAIL`，说明当前使用点数量、错误上浮位置，以及建议保留或迁移到哪个共享目录。
6. 入口是否唯一，且模块根目录是否错误创建了包级公共入口？
   - 可配合 `verify-rules.mjs` 校验结构；脚本 `PASS` 只代表结构通过，不代表实现整体通过。
7. 是否没有 deep import、穿透私有目录或伪共享层？
   - 若不符合，标记 `FAIL`，必须给出具体 import 语句、文件位置和应改用的公开入口或正确位置。
8. 是否运行了与风险匹配的现有 lint、typecheck、test、build 或浏览器验证？
   - 缺少脚本或依赖时标记 `MISSING`，未执行标记 `NOT RUN`，失败标记 `FAIL`。

## 评审输出最低要求

- 先写目标分类和本次检查范围。
- 给出总结论：`PASS`、`FAIL`、`MISSING` 或 `NOT RUN`。
- 每个问题都要包含：规则点、证据（文件路径和位置）、问题说明、可执行的改动建议。
- 改动建议必须能直接交给其他 AI 实现，不得只写“建议优化”“建议调整”“建议规范化”。
