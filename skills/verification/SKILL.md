---
name: verification
description: Use when 准备宣称完成，或测试已通过但还需要整理最终验证证据与剩余风险。
---

# Verification

## Overview

这个 skill 定义仓库级的完成前验证习惯，用来补充 `superpowers/verification-before-completion`，强调什么才算真正验证过。

## Quick Reference

- 先遵守 `superpowers/verification-before-completion`
- 最后一次修改后重新跑验证命令，不用旧输出
- 逐条对照任务要求确认覆盖范围
- 明确写出未验证范围、阻塞原因和剩余风险
- skill 布局更新时把 `node --test tests/skill-first-layout.test.mjs` 当成必需验证证据

## Common Mistakes

- 只看 exit code，不读完整输出
- 用之前跑过的结果充当当前证据
- 测试通过后直接宣称完成，不再检查验证覆盖

## Related Skills

- `standard-workflow`
- `testing`
- `superpowers/verification-before-completion`
- `wrap-up`
