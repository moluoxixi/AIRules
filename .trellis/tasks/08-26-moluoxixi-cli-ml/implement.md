# 实施计划

## 1. 建立安全修改点

- [x] 记录 rebuild 当前 HEAD、状态与 AIRules 根状态。
- [x] 在当前 rebuild HEAD 创建并切换到有名本地维护分支。
- [x] 确认 `.sync/trellis` 只读镜像保持 clean。

## 2. 修改 rebuild 真源

- [x] 使用 `node packages/cli/scripts/bump-versions.js patch` 将 core/CLI 同步升到 `0.6.22`。
- [x] 将 CLI `bin.tl` 替换为 `bin.ml`，保留 `bin.moluoxixi`。
- [x] 将 `warnOpencodeUnavailable` 的用户提示从 `tl mem` 改为 `ml mem`。
- [x] 更新当前 CLI 规范的 `tl mem` 命令引用及活动测试 fixture；历史归档和哈希不改。
- [x] 强化 `verifyPackedCli` 的 packed bin 映射与旧 alias 否定断言。
- [x] 补充或更新聚焦测试，验证版本、manifest 和用户提示契约。

## 3. 验证 rebuild

- [x] 运行 CLI/core 聚焦测试。
- [ ] 分别运行 core/CLI build、test、lint、typecheck。
- [x] 运行 CLI `test:publish`、`lint:publish`、`check-versions` 与 `verify-packed-cli`。
- [x] 语义检索活动源码/规范中的 `tl`，逐项确认剩余命中均为历史或无关文本。
- [x] 分别 pack core/CLI，在临时 npm prefix 中完成 Trellis `tl` 与 Moluoxixi `ml` 的 Windows 共存安装验证。

## 4. 记录与导出

- [x] 复核 rebuild diff，只提交本任务改动到本地维护分支。
- [x] 直接运行完整导出器，清空并复制 rebuild `packages` 到 `roles/moluoxixi/packages`。
- [x] 验证 rebuild `packages` 与导出目标的受控文件集合和内容一致。

## 5. 验证 AIRules 集成

- [x] 更新 `roles/moluoxixi/__test__/moluoxixi-source.test.ts` 的 `ml`/无 `tl` 契约。
- [ ] 运行 `roles/moluoxixi/__test__`、角色 `verify:publish`、`typecheck`、`publish:dry-run` 和 `.sync` identity scanner。
- [ ] 运行 AIRules 根 lint/typecheck 与相关测试，检查最终工作区 diff。

## 6. 提交与发布

- [ ] 按项目提交规范提交 root 任务/导出/测试改动，并确认最终 commit 可发布。
- [ ] 推送 root `main` 到 `origin`，监控对应常规 CI 到达成功终态。
- [ ] 在最终 commit 创建不可变 tag `moluoxixi-v0.6.22`，验证 tag/version/package 契约后推送 tag。
- [ ] 通过浏览器监控 `Publish role packages` workflow；代码/网络失败按幂等策略处理，secret/OIDC 故障只记录证据并等待用户修复后重跑。
- [ ] workflow 成功后，用 `npm view` 验证 core/CLI `0.6.22`、`latest` 和 CLI bin 映射。
- [ ] 记录 workflow URL、发布版本与最终 git/tag 状态。

## 验证命令

在 rebuild 中使用精确 package filter：

```powershell
pnpm --filter @moluoxixi/airules-moluoxixi-core build
pnpm --filter @moluoxixi/airules-moluoxixi-core test
pnpm --filter @moluoxixi/airules-moluoxixi-core lint
pnpm --filter @moluoxixi/airules-moluoxixi-core typecheck
pnpm --filter @moluoxixi/airules-moluoxixi-cli build
pnpm --filter @moluoxixi/airules-moluoxixi-cli test
pnpm --filter @moluoxixi/airules-moluoxixi-cli lint
pnpm --filter @moluoxixi/airules-moluoxixi-cli typecheck
pnpm --filter @moluoxixi/airules-moluoxixi-cli test:publish
pnpm --filter @moluoxixi/airules-moluoxixi-cli lint:publish
node packages/cli/scripts/release-preflight.js check-versions
node packages/cli/scripts/release-preflight.js verify-packed-cli
```

在 AIRules 根：

```powershell
node roles/moluoxixi/.sync/scripts/verify-moluoxixi-identity.mjs
pnpm vitest run roles/moluoxixi/__test__
pnpm --dir roles/moluoxixi run verify:publish
pnpm --dir roles/moluoxixi run typecheck
pnpm --dir roles/moluoxixi run publish:dry-run
pnpm --dir roles/moluoxixi run release:check
pnpm --dir roles/moluoxixi run release:plan
npm run lint:check
npm run typecheck
```

## 明确禁止

- 不运行 rebuild 的 `packages/cli/scripts/release.js` 或任何会向其上游 remote push 的 `pnpm release*`。
- 不运行 `sync-moluoxixi-upstream.mjs --force-rebuild`。
- 不直接编辑 `roles/moluoxixi/packages`。
- 不使用 `npm --force`，不移动已推送 tag，不在本机直接执行 `npm publish`。
