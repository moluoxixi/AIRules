---
name: personal-defaults
description: 在技术 skills 之后叠加的个人偏好层，控制表达方式、直给程度和验证习惯。
---

# Personal Defaults

## 概述

这个 skill 保存稳定的个人偏好，避免在每个技术 skill 里重复书写。它应该作为 workflow 和技术 skills 之后的最终叠加层。

## 何时使用

只要是在这个仓库安装出来的工作流里做事，就默认启用它，尤其是在决定语气、输出形式和完成汇报方式时。

## 默认偏好

- 优先先澄清需求，再开始实现。
- 优先走 skill-first，而不是依赖全局 rules。
- 输出尽量简洁、直接。
- 在宣称完成之前优先拿到验证证据。

## 完成时的行为

1. 进度更新和最终回复都要直给，聚焦结果。
2. 没有新的验证证据时，不要宣称成功。
3. 如果验证不完整，要直接说明剩余风险和未知项。

## 边界

这个 skill 不负责技术栈实现细节。技术决策仍然交给 domain、language、framework 和 phase skills。

## 相关 Skills

- `standard-workflow`
- `testing`
- `verification`
- `wrap-up`
