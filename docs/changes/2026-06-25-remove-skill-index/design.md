# Design: Remove Static Skill Index

## 技术方案

`rules/AGENTS.md` 回归为纯 `rules/sources/*.md` 拼接产物。构建期不再扫描 `skills/*/SKILL.md` frontmatter，也不再把触发条件追加到 baseline。

安装期保留 skills 投影与宿主 baseline 投影，但删除 `regenerateVendorSkillIndex` 调用。`vendor/AGENTS.md` 只来自 `rules/AGENTS.md`，不再根据 vendor skills 重写静态索引。

变更包契约作为 `repo-maintenance` 文档和脚本存在：`docs/delivery/change-pack.md` 说明规则，`docs/changes/` 保存变更包，`scripts/verify-change-packs.mjs` 做结构校验。

## 兼容性

- 对支持直接读取 skills 的宿主无行为损失。
- 对仍只读 baseline 且不读取 skills 的宿主，不再提供静态触发索引；这是本次用户确认后的有意删除。
- 下游项目初始化规则不变。

## 回滚

如果未来发现某宿主仍需要静态索引，应重新建 L2 变更包，并优先在宿主能力配置层表达该差异，而不是默认把索引塞回所有 baseline。

## 验证策略

- `npm run rules:build`
- `npm run rules:check`
- `npm run verify:changes`
- 针对相关测试运行 vitest。
- L2 收口时运行 `npm run verify:control:l2`。
