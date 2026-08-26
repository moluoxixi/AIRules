# 迁移 Moluoxixi CLI 命令到 ml

## 目标

将 Moluoxixi CLI 的短命令从 `tl` 全量迁移为 `ml`，使其能够与继续占用 `tl` 的 `@mindfoldhq/trellis` 安全共存，并保证安装后的脚本、模板、帮助文本和用户工作流不再调用旧命令。

## 背景与已确认事实

- 当前 `@mindfoldhq/trellis@0.6.15` 和 `@moluoxixi/airules-moluoxixi-cli@0.6.21` 都声明全局 bin `tl`，npm 因 `EEXIST` 拒绝在同一 prefix 安装两者。
- Moluoxixi CLI 还暴露正式命令 `moluoxixi`；本任务只迁移短命令，不重命名 package，也不移除 `moluoxixi`。
- npm registry 已存在不可覆盖的 `@moluoxixi/airules-moluoxixi-cli@0.6.21`，其中仍声明 `tl`；只修改同版本源码不会修复通过 `latest` 安装的用户路径。
- 发布预检要求 core 与 CLI package 版本完全一致，因此若准备新版本，两个 package 必须同步从 `0.6.21` 升级。
- 角色 package 发布流水线由 tag push `moluoxixi-v<semver>` 触发；`moluoxixi-v0.6.22` 尚不存在，现有最高 tag 为 `moluoxixi-v0.6.21`。
- `roles/moluoxixi/.sync` 中源码镜像是只读输入；所有外部基线适配必须在 `roles/moluoxixi/.sync/rebuild` 完成并用本地 commit 记录。
- `roles/moluoxixi/packages` 只能在 rebuild 验证通过后清空并完整复制导出，禁止直接编辑。

## 需求

1. Moluoxixi CLI package 的 bin 映射保留 `moluoxixi`，将 `tl` 替换为 `ml`，不再声明 `tl`。
2. Moluoxixi 自带的运行脚本、hooks、模板、生成文件、测试和用户可见文档中，凡是指向本 package CLI 的 `tl` 调用都迁移为 `ml`。
3. 不能机械替换与本 CLI 无关的文本，例如普通单词片段、第三方内容或明确描述历史兼容行为的证据；所有命中必须按语义分类。
4. 迁移后的安装流程必须允许 `@mindfoldhq/trellis` 保留 `tl`，同时安装 Moluoxixi CLI 并通过 `ml` 与 `moluoxixi` 调用。
5. rebuild 内修改和验证完成后，按仓库边界完整导出 `packages`，并保持 rebuild 与导出目标一致。
6. core 与 CLI 同步从 `0.6.21` 升级到 `0.6.22`。
7. 所有本地门禁通过后，提交并推送 AIRules `main`，在最终发布 commit 上创建并推送不可变 tag `moluoxixi-v0.6.22`，由 GitHub Actions 发布 core 与 CLI。
8. 监控发布流水线到终态成功，并从 public npm registry 验证版本、dist-tag 和 CLI bin 契约。

## 验收标准

- [ ] package 元数据中 `bin.ml` 指向 Moluoxixi CLI 入口，`bin.moluoxixi` 保持不变，`bin.tl` 不存在。
- [ ] core 与 CLI package 版本均为 `0.6.22`，发布预检确认二者严格一致。
- [ ] 所有属于 Moluoxixi CLI 的可执行调用、帮助文本和模板输出都使用 `ml`；语义检索确认没有遗漏的活动 `tl` 调用。
- [ ] 相关单元测试、集成测试、类型检查、lint 和构建通过。
- [ ] npm 打包检查确认产物中的 bin 映射正确。
- [ ] 在隔离的本机 npm prefix 中复现 `tl -> @mindfoldhq/trellis` 后，可安装本地 `0.6.22` tarball，且 `tl` 仍指向 Trellis，`ml` 和 `moluoxixi` 指向 Moluoxixi CLI；用户当前全局环境不被改动。
- [ ] `roles/moluoxixi/.sync/rebuild/packages` 与 `roles/moluoxixi/packages` 完整一致。
- [ ] AIRules 最终提交已推送到 `origin/main`，`moluoxixi-v0.6.22` 指向该提交且已推送。
- [ ] `main` push 对应的常规 GitHub CI 到达成功终态。
- [ ] GitHub Actions `Publish role packages` 对该 tag 执行成功，core 与 CLI 均发布为 `0.6.22`。
- [ ] public npm registry 的 `latest` 指向 `0.6.22`，CLI published manifest 只暴露 `moluoxixi` 与 `ml`，不暴露 `tl`。

## 范围外

- 不修改 `@mindfoldhq/trellis` 的 package 或其 `tl` 命令。
- 不使用 `npm --force` 覆盖冲突 shim。
- 不改变 Moluoxixi CLI 的 package 名、长命令 `moluoxixi` 或业务功能。
- 不修改 `roles/moluoxixi/.sync` 的只读源码镜像，也不处理许可证文件。
- 不在本机直接执行 `npm publish`；package 发布只通过已授权的 GitHub Actions 流水线完成。
- 不创建 GitHub Release；现有角色发布 workflow 不监听 release 事件。

## 技术证据

- 活动产品行为命中集中在 `packages/cli/package.json` 的 `bin.tl` 和 `packages/cli/src/commands/mem.ts` 的用户提示；当前 CLI 规范另有 16 处 `tl` 命令引用。
- role 契约测试 `roles/moluoxixi/__test__/moluoxixi-source.test.ts` 当前硬编码 `bin.tl`，需要改为 `bin.ml` 并增加旧 alias 的否定断言。
- `packages/cli/scripts/release-preflight.js` 当前只验证 packed core 依赖版本，不验证 tarball 的 bin 映射；需要补充 `moluoxixi`/`ml`/无 `tl` 契约。
- `.github/workflows/publish-role-packages.yml` 监听 `moluoxixi-v0.6.22` tag push，按 core→CLI 顺序发布，并在发布前运行角色 verify/typecheck 门禁。
- workflow 使用 `NPM_TOKEN` 与 `id-token: write`/provenance；包级发布具有精确版本跳过语义，可安全重跑部分失败的同一 tag workflow。
- rebuild 中归档任务、开发者 journal、历史 task 标题和锁文件哈希里的 `tl` 不属于活动 CLI 调用，不应机械改写。
- rebuild 验证使用 pnpm workspace 的 build/test/lint/typecheck/publish gates；通过后先在 rebuild 创建本地 commit，再完整导出 packages 并运行角色发布验证。

## 已确认决策

- 使用公开短命令 `ml`，完全移除 Moluoxixi package 对 `tl` 的声明；canonical 长命令 `moluoxixi` 保持不变。
- 使用无发布副作用的版本脚本将 core 与 CLI 同步准备为 `0.6.22`。
- 本地完成源码、打包和共存安装验证后，推送 `main` 与不可变 tag `moluoxixi-v0.6.22`，由 GitHub Actions 执行 npm 发布。
- 发布失败时优先重跑同一 workflow；若发布内容需要修改或任一包已经发布，不移动旧 tag，改用新的 patch 版本和 tag。
