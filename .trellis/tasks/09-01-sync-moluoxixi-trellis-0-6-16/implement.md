# 执行计划：同步 Moluoxixi 至 Trellis 0.6.16

## 1. 收敛范围

- [x] 固定上游 `0.6.16` / `88f4834449da9b4f607ec05e322408a0aa66f2ce`。
- [x] 完成 identity transform 和必要 Moluoxixi 适配，版本设为 `0.6.23`。
- [x] 在 spec 中写入“工具不能替代人工语义审查”和非阻塞问题默认延后的规则。
- [x] 删除角色级通用同步防护测试，撤销额外 publish-suite commit。

## 2. 整理与导出

- [x] 清理 rebuild 中生成的 `dist`、`node_modules` 和 `__pycache__`。
- [x] 保留 `34171e6714` 的实际 Moluoxixi workspace 过滤器修正。
- [x] 从 clean rebuild 清空并完整导出 `roles/moluoxixi/packages`。
- [x] 验证 rebuild 与正式 packages 的路径和 hash 完全一致。

## 3. 定向验证

- [x] 检查 core/CLI 版本、包名和 CLI aliases。
- [x] 运行必要 build、typecheck、lint、相关包测试和角色 identity 测试。
- [x] 运行 spec 本地链接与索引检查、`git diff --check`。
- [x] 使用 `trellis-check` 做最终范围内审查；非阻塞发现不扩大任务。

## 4. 提交与推送

- [x] 确认两个用户迁移文件未被改动或纳入提交。
- [ ] 提交 spec、清理和重新导出的变更。
- [ ] 推送 `main` 到 `origin`。
- [ ] 完成 Trellis 收尾并归档任务。

## 验证记录

- rebuild `build`、`typecheck`、`lint` 通过；CLI `test:publish` 167 项通过、9 项跳过；core 定向测试 112 项通过。
- CLI 新行为定向组 200 项通过、12 项按平台跳过。完整 `update.integration` 另有 6 项历史 migration/config fixture 失败，属于被角色排除的上游历史边界，按本次范围决策延后。
- 根级 Moluoxixi 角色与发布契约 60 项通过，根级 typecheck、lint 通过。
- identity 检查通过；rebuild 与正式 packages 共 500 个文件，路径与内容完全一致。
- 7 份有效 spec 的本地链接全部可解析，分类索引覆盖完整，`git diff --check` 通过。
