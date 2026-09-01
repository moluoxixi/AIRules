# 同步 Moluoxixi 至 Trellis 0.6.16

## 目标

将 Moluoxixi 的外部 Trellis 基线从 `0.6.15` 升级到 `0.6.16` / `88f4834449da9b4f607ec05e322408a0aa66f2ce`，保留当前仍必需的 Moluoxixi 适配，以版本 `0.6.23` 完整导出并推送 AIRules 主仓。

## 需求

- `.sync/trellis` 保持只读且固定到目标 commit；所有本地适配只在 `.sync/rebuild` 提交。
- 先运行确定性 identity transform，再由人逐项判断旧适配应保留、改写还是删除。
- 只保留包身份、`moluoxixi` / `ml` CLI、版本、必要发布契约和 AIRules 扩展；接受上游已经等价实现的行为。
- 自动工具只能暴露或阻止静默丢失，不能承诺自动保留语义适配；每次升级都要人工审查。
- 发现与本次验收无关的问题时记录并延后。只有真实阻塞项或用户明确批准时才扩大范围。
- 撤销本次产生的 publish-suite 分类和通用同步防护测试，不把一次版本升级改造成同步框架重设计。
- rebuild 验证通过后先清空 `roles/moluoxixi/packages`，再完整复制 `.sync/rebuild/packages`。
- core 与 CLI 统一使用 `0.6.23`；npm 已存在 `0.6.16`，不得覆盖旧版本或把 `latest` 回指旧产物。
- 不发布 npm、不修改 dist-tag；本次允许提交并推送 `main` 到 `origin`。

## 验收标准

- [x] 源镜像 clean、detached 在固定 commit；rebuild clean 且从该 commit 派生。
- [x] rebuild 只保留 identity transform、必要 Moluoxixi 适配和包名门禁修正，额外 publish-suite commit 已通过 revert 撤销。
- [x] core/CLI 都是 `0.6.23`，CLI 有 `moluoxixi` 与 `ml` 且没有 `tl`。
- [x] 必要 build、typecheck、lint、定向测试与角色 identity 检查通过。
- [x] rebuild 与正式 packages 的相对路径集合和逐文件 hash 完全一致。
- [x] `.trellis/spec` 记录人工语义审查和最小范围决策，索引完整且无空模板规范层。
- [x] 不改动用户已有的迁移脚本文件，不执行 npm 发布或 dist-tag 变更。
- [x] AIRules 变更提交后成功推送到 `origin/main`。

## 不在范围内

- 通用同步框架、自动语义合并或“永不丢适配”的保证。
- publish suite 的重新分类、仓库测试治理或与本次验收无关的测试修复。
- 许可证、NOTICE、COPYRIGHT 等法律文件。

## 已确认决策

- 使用 `0.6.23` 作为本次 Moluoxixi 包版本，不把已发布的 `0.6.16` 作为新的 `latest`。
- 同步流程固定为：pin commit、identity transform、人工重放必要适配、定向测试、完整导出。
- 用户批准修复、提交并推送；后续非阻塞发现默认延后。
