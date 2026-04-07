---
name: verification
description: Use when 准备宣称完成，或测试已通过但还需要整理最终验证证据与剩余风险。
---

# Verification

## 概述

这个 skill 定义仓库级的完成前验证习惯，用来补充 `superpowers/verification-before-completion`，强调什么才算真正完成前验证。

## 何时使用

- 准备宣称完成
- 测试已通过，但还没有整理完整验证证据
- 需要把验证结果和剩余风险对齐到任务要求

## 不在这些情况下使用

- 你还停留在测试设计阶段
- 当前还没拿到任何新的命令输出或验证证据

## 核心指导

- 先遵守 `superpowers/verification-before-completion`
- 最后一次修改后重新跑验证命令，不使用旧输出
- 逐条对照任务要求确认覆盖范围
- 明确写出未验证范围、阻塞原因和剩余风险

## 常见误区

- 只看 exit code，不读完整输出
- 用之前跑过的结果充当当前证据
- 测试通过后直接宣称完成，不再检查验证覆盖

## 相关 Skills

- `standard-workflow`
- `testing`
- `superpowers/verification-before-completion`
- `wrap-up`
