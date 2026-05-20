# 前端组件校验清单

本文件只提供校验脚本用法和检查清单，不定义新规则；规则以 `SKILL.md` 为准。

## 脚本用法

```bash
node skills/workflow/frontend-component-standard/scripts/verify-rules.mjs
node skills/workflow/frontend-component-standard/scripts/verify-rules.mjs simple-component --root src/components/StatusBadge.vue
node skills/workflow/frontend-component-standard/scripts/verify-rules.mjs component --root src/components/DataTable
```

## 检查清单

1. 是否先确认了组件职责、调用方和真实交互路径？
   - 未阅读时标记 `NOT RUN`，不得伪装成已完成审查。
2. 目标类型是否判断清楚：`simple-component` 还是 `component-package`？
   - 分类不确定时说明候选分类和分歧原因。
3. 当前结构是否还保留了只为兼容旧实现存在的目录、双入口或冗余 wrapper？
   - 若存在，标记 `FAIL`，指出具体文件并给出删除或重建建议。
4. 实现是否覆盖当前职责下真实存在的 loading、empty、error、disabled、readonly 等状态？
   - 若不符合，标记 `FAIL`，指出缺失状态出现在哪条交互路径，并给出最小改动建议。
5. 状态是否就近保留，没有无依据上浮到 store、context、hook 或 composable？
   - 若不符合，标记 `FAIL`，说明当前状态为何不应上浮，以及建议回收到哪个文件或组件边界。
6. 类型是否表达真实契约，没有使用 `any`、空对象或可选字段掩盖问题？
   - 若不符合，标记 `FAIL`，指出具体类型声明和建议替换方式；不得只写“补充类型”。
7. 公共入口是否唯一，且外部导入是否经过公开入口？
   - 可配合 `verify-rules.mjs` 校验结构；脚本 `PASS` 只代表结构通过，不代表实现整体通过。
8. 是否没有 deep import、穿透 `src/` 或泄露私有实现？
   - 若不符合，标记 `FAIL`，必须给出具体 import 语句、文件位置和应改用的公开入口。
9. 是否运行了与风险匹配的现有 lint、typecheck、test、build 或浏览器验证？
   - 缺少脚本或依赖时标记 `MISSING`，未执行标记 `NOT RUN`，失败标记 `FAIL`。

## 评审输出最低要求

- 先写目标分类和本次检查范围。
- 给出总结论：`PASS`、`FAIL`、`MISSING` 或 `NOT RUN`。
- 每个问题都要包含：规则点、证据（文件路径和位置）、问题说明、可执行的改动建议。
- 改动建议必须能直接交给其他 AI 实现，不得只写“建议优化”“建议调整”“建议规范化”。
