# 执行计划：同步 Moluoxixi 至 Trellis 0.6.16

## 1. 安全快照与测试基线

- [ ] 确认 AIRules 主仓除已知用户文件和本任务文档外没有会被覆盖的改动。
- [ ] 确认 `.sync/trellis` 与 `.sync/rebuild` 均干净，记录 remote、worktree、分支和完整 SHA。
- [ ] 固定旧 rebuild 回滚锚点 `codex/moluoxixi-cli-ml` / `c8f78016e...`，列出 `001adcce...HEAD` 的最终差异和提交意图。
- [ ] 在变更前运行现有 Moluoxixi identity、角色契约和发布预检测试，记录基线结果。

回滚点：本阶段只读；任何状态不符都停止，不做 checkout 或导出。

## 2. 先加同步保护

- [ ] 在 `roles/moluoxixi/__test__/` 增加失败用例，证明纯 identity transform、错误 rebuild 分支、输出版本不符或 dirty worktree 时不能导出。
- [ ] 在 ignored `.sync` 维护区实现 `rebuildBranchPattern` 展开、旧分支保留、目标分支校验和输出版本门禁。
- [ ] 更新 ignored manifest/README，记录 upstream `0.6.16`、完整 SHA、输出 `0.6.23` 和新保护行为。
- [ ] 运行同步脚本 dry-run 与新增角色测试，确认保护先于任何破坏性复制生效。

回滚点：脚本或测试失败时仅修正 `.sync` 本地维护工具与角色测试，正式 packages 不变。

## 3. 建立 0.6.16 rebuild 基线

- [ ] fetch 并验证 lightweight tag `v0.6.16` 精确指向 `88f4834449da9b4f607ec05e322408a0aa66f2ce`，且旧 revision 是其祖先。
- [ ] 将源镜像 detached checkout 到目标 commit 并确认干净。
- [ ] 从目标 commit 创建或安全复用 `moluoxixi/rebuild-88f4834449da`，不得覆盖同名异常分支。
- [ ] 运行确定性 rename，继续排除 migration manifests，创建 identity transform 本地 commit。
- [ ] 验证此时 `--export` 因输出仍为 `0.6.16` 而被门禁拒绝。

回滚点：切回保留的旧分支；不删除旧引用，不导出。

## 4. 语义重放 Moluoxixi 适配

- [ ] 对最终有效适配逐项判断“上游已包含 / 仍需重建 / 应删除”，把结论记录在 commit 或任务研究文档中。
- [ ] 人工合并 core/CLI manifests，设置版本 `0.6.23`，保留包身份、双 CLI bin、provenance 与发布门禁。
- [ ] 接受上游 OpenCode memory reader，删除过时 unavailable warning，仅保留适用的 Moluoxixi 命令文案。
- [ ] 复核 build-without-migrations、OpenCode ESM、release scripts、templates 与文档适配，不重放已撤回 knowledge ingestion。
- [ ] 同步 rebuild 内测试并创建语义清晰的本地 adaptation commit(s)。

回滚点：对尚未导出的 rebuild 适配进行普通修正或新建纠正 commit；不改写旧分支。

## 5. Rebuild 验收

- [ ] 安装或复用锁定依赖，运行 core 与 CLI build、typecheck、test、lint。
- [ ] 运行 `test:publish`、`lint:publish` 和 publish dry-run / pack 边界检查。
- [ ] 运行 identity verifier，确认无遗留 `@mindfoldhq`、Trellis 包身份、`tl` bin 或 migration manifests。
- [ ] 专项验证中文 task/context manifests、fresh init/update、OpenCode memory、channel、path containment 与 symlink 行为。
- [ ] 确认目标分支正确、输出版本为 `0.6.23`、rebuild worktree 干净，`--export --dry-run` 可通过全部前置门禁。

回滚点：任何失败都留在 rebuild 修复，不触碰正式 packages。

## 6. 完整导出与主仓验证

- [ ] 再次确认 `roles/moluoxixi/packages` 在导出前没有用户改动。
- [ ] 使用受保护的同步流程先清空正式 packages，再完整复制 `.sync/rebuild/packages`。
- [ ] 比较 rebuild 与正式 packages 的路径集合、文件数量和逐文件 hash，要求完全一致。
- [ ] 更新 `roles/moluoxixi/__test__/moluoxixi-source.test.ts` 等角色契约中的目标版本为 `0.6.23`；所有产品代码变更都应来自 rebuild 导出。
- [ ] 运行 Moluoxixi 全部角色测试、相关根级测试、lint、typecheck、identity verifier 与 `git diff --check`。
- [ ] 检查 diff 仅包含计划内的完整导出、角色测试、任务文档和必要规范更新，现有迁移脚本保持原状。

回滚点：若导出后失败，仅撤回本次生成的 packages/测试改动或从旧 rebuild tip 完整重导；保留失败现场直到原因明确。

## 7. 收尾门禁

- [ ] 运行 `trellis-check` 做规范、测试、数据流、复用与一致性检查，并修复有效发现。
- [ ] 判断本次同步暴露的分支/导出门禁是否需要写入项目 spec；需要时使用 `trellis-update-spec`。
- [ ] 分别确认 `.sync/trellis` 干净、目标 rebuild 分支干净、rebuild 与正式 packages 一致。
- [ ] 在 AIRules 主仓创建本地提交；在 rebuild 保留本地同步与适配提交。
- [ ] 明确确认没有执行 npm publish、dist-tag 修改或远端 push。

## 建议验证命令族

实施时应根据 package scripts 的实际入口确认并运行以下命令族，不凭计划文本猜测不存在的脚本：

```powershell
node roles/moluoxixi/.sync/scripts/sync-moluoxixi-upstream.mjs --dry-run
node roles/moluoxixi/.sync/scripts/verify-moluoxixi-identity.mjs
pnpm --dir roles/moluoxixi/.sync/rebuild/packages/core build
pnpm --dir roles/moluoxixi/.sync/rebuild/packages/core typecheck
pnpm --dir roles/moluoxixi/.sync/rebuild/packages/core test
pnpm --dir roles/moluoxixi/.sync/rebuild/packages/cli build
pnpm --dir roles/moluoxixi/.sync/rebuild/packages/cli typecheck
pnpm --dir roles/moluoxixi/.sync/rebuild/packages/cli test
pnpm --dir roles/moluoxixi/.sync/rebuild/packages/cli test:publish
npm run verify:moluoxixi-identity
git diff --check
```
