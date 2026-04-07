---
name: testing
description: Use when 行为已经变化，需要补测试、决定先跑哪些检查，或为改动提供直接测试证据。
---

# Testing

## 概述

这个 skill 定义仓库级的测试习惯，用来补充 `superpowers/test-driven-development`，说明在这个仓库里怎么收敛测试范围、怎么整理测试证据。

## 何时使用

- 行为已经变化，需要补测试或调整断言
- 你在决定应该先跑哪个测试命令
- 你需要给当前改动提供直接测试证据

## 不在这些情况下使用

- 你还没有明确改动行为是什么
- 当前更需要的是完成前验证，而不是测试设计

## 核心指导

- 先遵守 `superpowers/test-driven-development` 的红绿循环
- 先跑最小相关测试，再逐步放大
- 至少保留一个直接覆盖改动行为的测试或断言
- 记录命令、通过/失败结果和必要的失败信息

## 常见误区

- 只跑大而全的测试套件，不先确认最小失败面
- 用脆弱断言验证偶然格式，而不是验证行为
- 有测试缺口却不在交接时说明

## 相关 Skills

- `standard-workflow`
- `superpowers/test-driven-development`
- `verification`
- `wrap-up`
