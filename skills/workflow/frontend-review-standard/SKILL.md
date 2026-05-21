---
name: frontend-review-standard
description: 用于评审 Vue 3 / React 组件、模块和前端库改动时，输出基于证据的目标分类、检查范围、问题说明和可执行改动单；适合代码审查和交接实现任务，不做兼容式模糊建议。
---

# 前端评审输出标准

## 使用场景

当任务目标是检查某个前端组件、模块或库是否符合实现标准，或者需要整理一份可以直接交给其他 AI 继续实现的改动单时，使用本 Skill。

本 Skill 只规定评审输出格式和证据要求，不定义组件、模块或库本身的实现规则。实现规则分别来自：

- `vue-component-standard` 或 `react-component-standard`
- `vue-module-standard` 或 `react-module-standard`
- `frontend-library-standard`

## 工作顺序

1. 先判断目标分类：`simple-component`、`component-package`、`business-module`、`ordinary-module`、`utility-library` 或 `ui-library`。
2. 说明本次实际阅读和检查的文件、目录、调用方或验证命令；未检查部分标记 `NOT RUN`。
3. 结合对应实现标准给出总结论：`PASS`、`FAIL`、`MISSING` 或 `NOT RUN`。
4. 逐条列出问题：规则点、证据、问题说明、可执行改动建议。
5. 最后按文件归并改动建议，整理成可以直接交给其他 AI 实现的改动单。

## 输出要求

### 必须包含

1. 目标分类
2. 检查范围
3. 总结论
4. 问题列表
5. 改动建议汇总

### 每个问题都必须包含

- 编号
- 严重级别：`critical`、`major` 或 `minor`
- 对应规则点
- 证据：文件路径和位置
- 问题说明：说明为什么不符合当前目标，而不是只复述规则
- 改动建议：给出可直接执行的修改方向、目标文件和建议落点

## 禁止

- 只复述规则，不指出当前代码哪里不符合。
- 只写“建议优化”“建议调整”“建议规范化”这类空泛建议。
- 没有证据就断言存在问题。
- 把未检查项、缺少脚本或未验证的内容写成 `PASS`。
- 把结构校验脚本的 `PASS` 当成实现整体 `PASS`。

## 辅助资源

- 示例：`examples/`
- 校验清单：`validation/checklist.md`
- 自校验脚本：`scripts/verify-rules.mjs`
