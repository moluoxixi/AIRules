# `tl` 到 `ml` 影响面与发布研究

## 结论

- npm 全局安装失败的根因是确定性的 bin 冲突：`@mindfoldhq/trellis@0.6.15` 与 `@moluoxixi/airules-moluoxixi-cli@0.6.21` 都声明 `tl`。Node、npm、NVM 和 registry 不是根因。
- Moluoxixi 的活动产品行为只有两个直接入口：CLI package 的 `bin.tl`，以及 `mem` 命令的用户可见 `tl mem` 降级提示。
- 当前 CLI 规范还包含 16 处 `tl` 命令引用；活动测试 fixture 有一处 `tl mem` 示例。归档任务、开发者 journal 和锁文件哈希中的 `tl` 是历史或噪声，不应机械改写。
- registry 上的 `0.6.21` 不可覆盖。要让后续 `latest` 安装真正修复，必须准备新版本；release preflight 要求 core/CLI 版本严格一致，因此二者同步准备为 `0.6.22`。

## 代码与契约证据

- `roles/moluoxixi/.sync/rebuild/packages/cli/package.json:8`：当前 bin 同时包含 `moluoxixi` 与 `tl`，二者指向 `./bin/moluoxixi.js`。
- `roles/moluoxixi/.sync/rebuild/packages/cli/src/commands/mem.ts:132`：`warnOpencodeUnavailable` 输出 `tl mem`。
- `roles/moluoxixi/.sync/rebuild/.trellis/spec/cli/backend/commands-mem.md:1`：当前 `tl mem` 命令规范；同文件另有命令示例、性能表和入口说明。
- `roles/moluoxixi/.sync/rebuild/.trellis/spec/cli/backend/index.md:29` 与 `trellis-core-sdk.md:33`：当前规范索引和 SDK 说明仍引用 `tl mem`。
- `roles/moluoxixi/.sync/rebuild/packages/core/test/mem/phase.test.ts:164`：活动测试 fixture 标题引用 `tl mem`，可改为 `ml mem` 以避免当前示例继续传播旧命令。
- `roles/moluoxixi/__test__/moluoxixi-source.test.ts:273`：角色产物契约硬编码 `bin.tl`，应改为 `bin.ml` 并显式否定 `bin.tl`。
- `roles/moluoxixi/.sync/rebuild/packages/cli/scripts/release-preflight.js:225`：`verifyPackedCli` 当前只验证 packed core 精确依赖，尚未验证 bin 映射。

## 版本与发布证据

- `roles/moluoxixi/.sync/rebuild/packages/cli/scripts/bump-versions.js:104`：`patch` 会先校验 core/CLI 当前版本一致，再计算下一 patch。
- 同文件 `:118`：脚本只写两个 package.json；不会 commit、tag、push、publish，也不会更新 lockfile。
- `roles/moluoxixi/.sync/rebuild/packages/cli/scripts/release.js:141`：完整 release 流程会提交、创建 tag 并 push，且 rebuild 当前为 detached HEAD；本任务禁止调用。
- `roles/moluoxixi/.sync/rebuild/packages/cli/scripts/release-preflight.js:143`：core/CLI 版本必须严格一致。
- `pnpm-lock.yaml` 不记录 workspace package 自身版本，版本 bump 不要求更新；但其 CLI importer 仍带既有 `@mindfoldhq/trellis-core` identity，不在本任务顺手修复。

## 同步边界

```text
.sync/trellis（固定只读上游）
  -> .sync/rebuild/packages（唯一适配真源 + 本地 commit）
  -> .sync/scripts/export-moluoxixi-upstream.mjs（完整替换）
  -> roles/moluoxixi/packages（导出目标）
```

- 导出器会先删除整个目标再复制；失败时会删除半成品，但不会自动恢复旧目录。
- 本次人工适配不能重新运行从固定镜像重建 packages 的主同步阶段，否则可能覆盖本地修改；应在 rebuild 验证并提交后直接调用完整导出器。
- `roles/moluoxixi/packages` 不直接编辑。

## 验证策略

- 在 rebuild 使用精确的 Moluoxixi package filters 运行 build/test/lint/typecheck，而不是仍含上游 identity 的根 workspace filter。
- 强化 `verify-packed-cli`：验证 packed manifest 保留 `moluoxixi`、新增 `ml`、不存在 `tl`，并保留 core 精确版本断言。
- 使用本地 core/CLI tarball 和隔离 npm prefix 模拟 Windows 共存安装：先安装现有 Trellis package，再同时安装两个 Moluoxixi tarball；验证 `tl` 仍归 Trellis，`ml`/`moluoxixi` 指向 Moluoxixi。
- 最后运行角色测试、发布 gate、identity scanner，并比较 rebuild/export 的受控文件集合。
