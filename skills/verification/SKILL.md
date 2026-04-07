---
name: verification
description: Use when 准备宣称完成，或测试已通过但还需要整理最终验证证据与剩余风险。
---

# Verification

## 概述

这个 skill 定义仓库级的完成前验证检查，用来补充 `superpowers/verification-before-completion`，强调这个代码库里什么才算真正验证过。

## 何时使用

在准备汇报完成之前立刻使用，尤其是在测试通过、最终交付之前。

## 硬约束

1. 先遵守 `superpowers/verification-before-completion` 这套主规则。
2. 最后一次修改后要重新跑相关验证命令，不能使用旧输出。
3. 结果要对照任务要求确认，而不只是看 exit code。
4. 任何未验证范围都要明确写成风险或后续工作。

## 流程

1. 把每条要求映射到具体证据，例如测试命令、文件检查、行为检查。
2. 重新运行所需命令，并读完整输出。
3. 逐条确认要求是否被覆盖，并找出缺口。
4. 在最终交接里明确总结证据及其通过/失败结果。

## 仓库说明

- 对 skill 布局更新，把
  `node --test tests/skill-first-layout.test.mjs`
  视为必需验证证据。
- 如果验证跑不起来，要明确写出阻塞原因和缺失的具体证据。

## 边界

这个 skill 不定义实现策略或测试策略。测试执行流程交给 `testing`，代码或内容决策交给各技术 skills。

## 相关 Skills

- `standard-workflow`
- `testing`
- `superpowers/verification-before-completion`
- `wrap-up`

