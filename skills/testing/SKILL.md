---
name: testing
description: Use when 行为已经变化，需要补测试、决定先跑哪些检查，或为改动提供直接测试证据。
---

# Testing

## 概述

这个 skill 定义仓库级的测试习惯，用来补充 `superpowers/test-driven-development`，说明在这个仓库里怎么收敛测试范围、怎么给出测试证据。

## 何时使用

在增加、修改或审查仓库行为时使用，可以和 TDD 并行，也可以在其后补充，尤其适合 skill 布局和工作流约定这类变更。

## 硬约束

1. 遵守 `superpowers/test-driven-development` 的红绿循环；这个 skill 不替代它。
2. 先跑最小相关测试命令，再按需要逐步放大。
3. 至少保留一个直接覆盖改动行为的测试或断言。
4. 不要只靠推理宣称完成，必须给出测试证据。

## 流程

1. 先识别和改动区域最贴近的测试命令。
2. 在迭代中持续跑定向检查。
3. 编辑完成后重新跑受影响的检查。
4. 记录简洁证据：命令、通过/失败结果、必要的失败信息。
5. 如果还存在测试缺口，要在交接时明确指出。

## 仓库说明

- 对 skill 树存在性或结构变更，运行：
  `node --test tests/skill-first-layout.test.mjs`
- 优先使用确定性的测试输入，避免依赖偶然格式的脆弱断言。

## 边界

这个 skill 是仓库级、阶段级指导。技术实现细节继续放在 domain/language/framework skills，完成宣称规则放在 `verification`。

## 相关 Skills

- `standard-workflow`
- `superpowers/test-driven-development`
- `verification`
- `wrap-up`

