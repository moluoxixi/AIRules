# 前端库校验清单

本文件只提供校验脚本用法和检查清单，不定义新规则；规则以 `SKILL.md` 为准。

## 脚本用法

```bash
node skills/workflow/frontend-library-standard/scripts/verify-rules.mjs
node skills/workflow/frontend-library-standard/scripts/verify-rules.mjs utility --root packages/BrowserToolkit
node skills/workflow/frontend-library-standard/scripts/verify-rules.mjs ui-library --root packages/MoluoxixiUI
node skills/workflow/frontend-library-standard/scripts/verify-rules.mjs component --root src/components/DataTable
```

## 检查清单

1. 是否先确认了库职责、调用方契约、运行环境和已有公共基础设施？
   - 未阅读时标记 `NOT RUN`，不得伪装成已完成审查。
2. 目标类型是否判断清楚：`utility-library`、`ui-library` 或 `component-package`？
   - 分类不确定时说明候选分类和分歧原因。
3. 当前结构是否还保留了只为兼容旧导出存在的双 barrel、镜像目录或过渡出口？
   - 若存在，标记 `FAIL`，指出具体文件并给出删除或重建建议。
4. 根入口是否只暴露稳定公共 API，内部实现是否留在 `src/`？
   - 若不符合，标记 `FAIL`，指出泄露实现的位置和建议调整后的公开入口。
5. README 是否覆盖使用方式、公共 API、主要约束和典型示例？
   - 若不符合，标记 `FAIL`，指出缺失章节和建议补充位置。
6. 是否没有 deep import、穿透 `src/` 或把私有目录当成半公开 API？
   - 若不符合，标记 `FAIL`，必须给出具体 import 语句、文件位置和应改用的公开入口。
7. 涉及浏览器、时间、随机数、网络和存储时，是否显式表达副作用依赖和失败语义？
   - 若不符合，标记 `FAIL`，指出具体实现和建议重构方向。
8. 是否运行了与风险匹配的现有 lint、typecheck、test、build 或浏览器验证？
   - 缺少脚本或依赖时标记 `MISSING`，未执行标记 `NOT RUN`，失败标记 `FAIL`。

## 评审输出最低要求

- 先写目标分类和本次检查范围。
- 给出总结论：`PASS`、`FAIL`、`MISSING` 或 `NOT RUN`。
- 每个问题都要包含：规则点、证据（文件路径和位置）、问题说明、可执行的改动建议。
- 改动建议必须能直接交给其他 AI 实现，不得只写“建议优化”“建议调整”“建议规范化”。
