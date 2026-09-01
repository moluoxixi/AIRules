# Research: Trellis 0.6.16 上游同步与 Moluoxixi 适配风险

- Query: 将 Moluoxixi 的 Trellis 外部基线从 0.6.15 升级到 0.6.16 时，确认上游与 rebuild 身份、差异规模、适配冲突、同步脚本风险、npm 版本选择，并给出安全的同步与验证顺序。
- Scope: mixed
- Date: 2026-09-01

## Findings

### 1. 基线身份与差异规模

- 当前同步清单固定 Trellis `0.6.15`，完整 commit 为 `bd454938dc406e2f692a07c3f3888e5375ff674d`；来源为 `https://github.com/mindfold-ai/Trellis.git`（`roles/moluoxixi/.sync/manifest.json:4-10`）。只读源镜像当前 HEAD 也指向该 commit。
- 目标 lightweight tag `v0.6.16` 对应 commit `88f4834449da9b4f607ec05e322408a0aa66f2ce`。旧基线是目标 commit 的祖先，`old..target` 相隔 23 个提交。
- 只统计 `packages/core` 和 `packages/cli`，上游差异为 88 个文件、`+14,317/-2,083`。这不是只改版本号的小升级，task/context gate、OpenCode memory、channel、路径与 symlink 处理都需要专项回归。

主会话上一轮只读调查记录了以下命令与结果；本 research agent 按角色限制未重跑 Git 命令：

```powershell
git -C roles/moluoxixi/.sync/trellis rev-parse 'v0.6.16^{commit}'
# 88f4834449da9b4f607ec05e322408a0aa66f2ce

git -C roles/moluoxixi/.sync/trellis merge-base --is-ancestor bd454938dc406e2f692a07c3f3888e5375ff674d 88f4834449da9b4f607ec05e322408a0aa66f2ce
# exit 0

git -C roles/moluoxixi/.sync/trellis rev-list --count bd454938dc406e2f692a07c3f3888e5375ff674d..88f4834449da9b4f607ec05e322408a0aa66f2ce
# 23

git -C roles/moluoxixi/.sync/trellis diff --shortstat bd454938dc406e2f692a07c3f3888e5375ff674d..88f4834449da9b4f607ec05e322408a0aa66f2ce -- packages/core packages/cli
# 88 files changed, 14317 insertions(+), 2083 deletions(-)
```

### 2. rebuild 的 11 个适配提交与重叠点

- 旧基线的自动生成提交是 `001adcce5de0`（`chore(sync): rebuild bd454938dc40`）；当前 rebuild HEAD 是 `c8f78016e265457fda3490bdd770560c0f15ff24`。
- 两者之间有 11 个本地适配提交，合计涉及 21 个文件、`+144/-51`。这些提交不是未提交脏状态，而是位于自动生成提交之后的有效 Moluoxixi 维护历史。
- 将上游变更路径按 identity rename 映射到 Moluoxixi 路径后，与 11 个适配提交直接重叠 3 个文件：
  - `packages/cli/package.json`
  - `packages/core/package.json`
  - `packages/cli/src/commands/mem.ts`
- 两个 package manifest 是强语义冲突。上游目标内容会带入 `0.6.16` 和上游身份；当前 Moluoxixi manifest 则保有 `0.6.22`、`moluoxixi`/`ml` 双 CLI、发布门禁、provenance 和 Moluoxixi repository：
  - core 的本地身份/版本见 `roles/moluoxixi/.sync/rebuild/packages/core/package.json:2-4`，provenance 见 `:40-43`，发布门禁见 `:44-55`，repository 见 `:77-80`。
  - CLI 的本地身份/版本见 `roles/moluoxixi/.sync/rebuild/packages/cli/package.json:2-4`，`ml` alias 见 `:8-10`，provenance 见 `:12-15`，发布门禁见 `:16-41`，repository 见 `:89-92`。
- `mem.ts` 的冲突应按目标行为处理，而不是保留旧文本。旧基线的 warning 使用 `tl mem`，Moluoxixi 适配只将其改为 `ml mem`（`roles/moluoxixi/.sync/rebuild/packages/cli/src/commands/mem.ts:124-143`）；上游 0.6.16 已恢复 OpenCode reader 并删除该 unavailable warning。因此语义重放应接受上游删除，不再移植旧 warning。

对应调查命令与结果：

```powershell
git -C roles/moluoxixi/.sync/rebuild rev-list --count 001adcce5de0..c8f78016e265457fda3490bdd770560c0f15ff24
# 11

git -C roles/moluoxixi/.sync/rebuild diff --shortstat 001adcce5de0..c8f78016e265457fda3490bdd770560c0f15ff24 -- packages/core packages/cli
# 21 files changed, 144 insertions(+), 51 deletions(-)
```

路径重叠是直接交集，不代表只有 3 个语义关注点。包身份、CLI 文案、模板目录、发布脚本和 AIRules extension 可能因全局 rename 或调用关系产生间接影响，仍需完整回归。

### 3. 当前同步脚本会静默丢失已提交适配

- 清单声明了 `rebuildBranchPattern: "moluoxixi/rebuild-<short-revision>"`（`roles/moluoxixi/.sync/manifest.json:20-23`），但 `readManifest()` 没有读取或校验该字段（`roles/moluoxixi/.sync/scripts/sync-moluoxixi-upstream.mjs:55-75`），后续也没有按 pattern 建立维护分支。
- `ensureRebuildWorktree()` 只把“工作树是否 dirty”当作适配保护。对于干净但 HEAD 位于基线之后的 rebuild，它发现 HEAD 不等于新 revision 后会直接 checkout 到 detached revision（`roles/moluoxixi/.sync/scripts/sync-moluoxixi-upstream.mjs:155-182`）。因此 11 个已提交适配不会触发 dirty guard。
- 脚本随后只从源镜像复制、identity rename 两个 package，并自动提交生成结果（`roles/moluoxixi/.sync/scripts/sync-moluoxixi-upstream.mjs:238-245`、`:279-292`）；没有查找旧自动生成提交之后的本地提交，也没有语义重放或“适配已验收”状态。
- 如果传入 `--export`，脚本会在生成提交后立即调用导出和 identity gate（`roles/moluoxixi/.sync/scripts/sync-moluoxixi-upstream.mjs:294-302`）。identity gate 只能发现残留的 Trellis 标识，不能证明 `ml`、发布门禁、版本、provenance 或 AIRules extension 仍存在。
- 导出函数会先递归删除整个正式 packages 目录，再完整复制 rebuild（`roles/moluoxixi/.sync/scripts/export-moluoxixi-upstream.mjs:47-68`）。因此按现状直接运行 README 推荐的一键 `--export` 命令，可能把纯 identity-transformed 的 0.6.16 结果覆盖到 `roles/moluoxixi/packages`。
- README 目前只承诺保护“未提交的本地适配”（`roles/moluoxixi/.sync/README.md:20-27`），与实际风险一致，但不足以保护已经提交的 11 个适配提交。

最小加固边界应是：真正使用并校验 `rebuildBranchPattern`；识别旧生成基线之后的本地适配；在新生成基线尚未完成语义重放和验证时拒绝 `--export`。本次无需把脚本重写成通用同步框架。

### 4. npm 版本与 dist-tag 结论

本地 rebuild 和正式导出的两个 manifest 当前都为 `0.6.22`：

- `@moluoxixi/airules-moluoxixi-core`：`roles/moluoxixi/.sync/rebuild/packages/core/package.json:2-3`
- `@moluoxixi/airules-moluoxixi-cli`：`roles/moluoxixi/.sync/rebuild/packages/cli/package.json:2-3`

2026-09-01 的 npm registry 实时查询：

```powershell
npm view "@moluoxixi/airules-moluoxixi-core" version dist-tags versions --json
# version/latest: 0.6.21
# versions: 0.6.16, 0.6.17, 0.6.18, 0.6.19, 0.6.20, 0.6.21

npm view "@moluoxixi/airules-moluoxixi-cli" version dist-tags versions --json
# version/latest: 0.6.21
# versions: 0.6.16, 0.6.17, 0.6.18, 0.6.19, 0.6.21
```

结论：

- 技术上可以把某个已经发布的版本重新绑定为 `latest`，例如把现有 `0.6.16` 设为 `latest`；这只会让 dist-tag 回指 2026-09-01 之前已经存在的旧 `0.6.16` tarball。
- npm 不允许用相同的 `package@version` 覆盖发布新内容。由于 core 和 CLI 的 `0.6.16` 均已占用，本次升级后的新产物不能再以 `0.6.16` 发布。
- 本地版本已经到 `0.6.22`。保持 `0.6.22` 会让新同步产物与当前仓库中的旧内容重号；降到 `0.6.16` 又会破坏版本单调性并撞上已发布版本。目标统一使用 `0.6.23` 是下一可辨识版本。
- 本任务明确不发布 npm、不修改 dist-tag；`0.6.23` 只是构建与未来发布所用的包版本决策。

### 5. 推荐同步与验证顺序

1. 固定输入：把 manifest 的 baseline 更新为 `0.6.16` / `88f4834449da9b4f607ec05e322408a0aa66f2ce`，确认源镜像 origin、commit、detached HEAD 和 clean 状态。源镜像始终只读。
2. 隔离生成基线：从目标 commit 创建符合 `moluoxixi/rebuild-88f4834449da` 规则的 rebuild 维护分支，执行 package identity rename 和 migration manifests 排除，单独提交纯生成结果。不要在此阶段导出。
3. 语义重放 11 个适配提交：逐项判断“保留、被上游取代、需要改写”。两个 package manifest 保留 Moluoxixi 身份、改为统一版本 `0.6.23`、保留 `ml` alias、发布门禁、provenance 和 repository；`mem.ts` 接受上游 OpenCode reader，删除旧 warning。
4. 加固同步脚本：消费 `rebuildBranchPattern`，检测上一生成基线后的本地适配，并增加未完成适配重放/验证时的 export 拒绝路径；角色专属测试放到 `roles/moluoxixi/__test__/`，不要放进公共 `scripts/lib/__test__/`。
5. 在 rebuild 内先验证：安装锁定依赖；依次运行 build、typecheck、tests、lint、`release:check`、`release:plan` 和各包 `test:publish`/`lint:publish`。专项覆盖中文 Trellis extension 的 `implement.jsonl`/`check.jsonl` 流程、OpenCode memory、channel、路径与 symlink。
6. 验证身份与发布契约：运行 `node roles/moluoxixi/.sync/scripts/verify-moluoxixi-identity.mjs`，同时断言两个 package 版本均为 `0.6.23`、CLI bin 同时包含 `moluoxixi` 和 `ml`、provenance/repository/发布门禁未丢失。
7. 最后导出：只有 rebuild 全部通过后，才清空 `roles/moluoxixi/packages` 并完整复制 `.sync/rebuild/packages`；随后比较两侧路径集合、逐文件内容和必要的可执行位，确认完全一致。
8. 在 AIRules 主仓运行 `roles/moluoxixi/__test__/` 和相关根级分发/打包测试，最后提交本地变更。不得执行 npm publish、npm dist-tag 修改或任何远端 push。

## Files Found

- `roles/moluoxixi/.sync/manifest.json`：当前上游 0.6.15 固定信息、三阶段路径和 rebuild branch pattern。
- `roles/moluoxixi/.sync/README.md`：现有一键同步、identity rename、migration manifest 排除和全量导出约定。
- `roles/moluoxixi/.sync/scripts/sync-moluoxixi-upstream.mjs`：源镜像刷新、detached rebuild、rename、自动提交和可选立即导出的实现；当前丢适配风险的核心位置。
- `roles/moluoxixi/.sync/scripts/export-moluoxixi-upstream.mjs`：先删除正式 packages、再全量复制 rebuild 的导出边界。
- `roles/moluoxixi/.sync/rebuild/packages/core/package.json`：core 的 Moluoxixi 身份、0.6.22 版本、provenance 和发布门禁。
- `roles/moluoxixi/.sync/rebuild/packages/cli/package.json`：CLI 的 Moluoxixi 身份、0.6.22 版本、`ml` alias、provenance 和发布门禁。
- `roles/moluoxixi/.sync/rebuild/packages/cli/src/commands/mem.ts`：旧 OpenCode unavailable warning 的 Moluoxixi 文案适配。
- `.trellis/tasks/09-01-sync-moluoxixi-trellis-0-6-16/prd.md`：已确认的升级目标、边界和验收标准。

## Related Specs

- `AGENTS.md`：Moluoxixi 外部基线维护边界要求源镜像只读、仅在 `.sync/rebuild` 适配并提交、验证后全量导出，以及角色测试归属。
- `.trellis/spec/distribution/index.md`：角色分发变更的前置检查和质量门禁。
- `.trellis/spec/distribution/role-capabilities.md`：角色自有 CLI、hooks、agents、packages 不进入公共 capability registry；角色专属行为应由角色契约测试覆盖。

## External References

- Trellis upstream: `https://github.com/mindfold-ai/Trellis.git`
- Target tag/commit: `v0.6.16` / `88f4834449da9b4f607ec05e322408a0aa66f2ce`
- npm core package: `@moluoxixi/airules-moluoxixi-core`, registry `latest=0.6.21`, `0.6.16` 已存在。
- npm CLI package: `@moluoxixi/airules-moluoxixi-cli`, registry `latest=0.6.21`, `0.6.16` 已存在。

## Caveats / Not Found

- Git 提交数、diff 统计和 3 个直接重叠路径来自主会话上一轮只读调查，本 research agent 因角色隔离未重跑 Git 命令；完整命令与结果已原样记录在上文。
- npm registry 结果是 2026-09-01 的时间点快照，未来发布前需再次查询目标版本和 dist-tags。
- 3 个文件是 identity-transformed 路径的直接交集，不是完整语义影响边界；最终仍需按调用关系和完整测试集检查间接回归。
- 上游 0.6.16 声明 `breaking=false`、`recommendMigrate=false`，但这不替代 Moluoxixi 的专项回归，也不表示 11 个本地适配可以省略。
- 按项目维护边界，本研究未审计、比较或修改许可证及其它法律文件。
