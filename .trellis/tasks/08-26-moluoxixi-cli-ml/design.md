# 技术设计

## 变更边界

本任务只迁移 Moluoxixi CLI 的短命令契约并准备对应 patch 版本：

```text
@mindfoldhq/trellis:       tl + trellis（保持不变）
@moluoxixi/...-cli 0.6.22: ml + moluoxixi（移除 tl）
```

运行时业务、canonical `moluoxixi` 命令、npm package 名、AIRules 通用 role package 安装器和第三方 Trellis package 均不变。

## 真源与数据流

1. 在 `roles/moluoxixi/.sync/rebuild` 当前适配 HEAD 上创建有名本地维护分支，避免新 commit 悬空。
2. 只修改 rebuild 中的 package 真源、活动源码、当前规范与测试 fixture。
3. 使用 `bump-versions.js patch` 将 core/CLI 同步改为 `0.6.22`；不调用带 commit/tag/push 的 `release.js`。
4. 运行 rebuild package gates 和 packed CLI 验证后创建本地 commit。
5. 直接调用完整导出器，将 rebuild `packages` 全量复制到 `roles/moluoxixi/packages`。
6. 在 AIRules 根更新角色产物契约测试，运行角色发布 gate 与 identity 检查。
7. 提交并推送 root `main`，在同一最终 commit 上创建并推送 `moluoxixi-v0.6.22`。
8. 监控 GitHub Actions 发布 job，到 public npm registry 验证成功。

## CLI 与打包契约

CLI package manifest 必须满足：

```json
{
  "bin": {
    "moluoxixi": "./bin/moluoxixi.js",
    "ml": "./bin/moluoxixi.js"
  }
}
```

`verifyPackedCli` 在现有 core 依赖精确版本检查之外，读取 tarball 的 `package/package.json` 并断言：

- `bin.moluoxixi === "./bin/moluoxixi.js"`
- `bin.ml === "./bin/moluoxixi.js"`
- `bin.tl` 不存在

该 gate 直接覆盖最终 npm manifest，避免源码 manifest 正确而发布 tarball 漂移。

## 文本迁移规则

- 修改活动运行时提示、当前 CLI 规范和当前测试 fixture 中代表 Moluoxixi 命令的 `tl`。
- 不改归档任务、历史 journal、发布历史材料、`TL;DR` 或 lockfile integrity 哈希。
- canonical `moluoxixi` 命令不是旧 alias，不替换。

## 共存验证

不依赖未发布的 registry `0.6.22`。分别 pack core 和 CLI，在临时 npm prefix 中安装现有 Trellis package与两个本地 tarball，验证 Windows shim：

- `tl --version` 仍输出 Trellis `0.6.15`
- `trellis --version` 仍可用
- `ml --version` 与 `moluoxixi --version` 均输出 `0.6.22`
- prefix 中没有由 Moluoxixi 覆盖的 `tl` shim

临时 prefix 验证完成后删除；不改变用户当前全局工具。

## GitHub 发布

- 这是有意移除旧短 alias 的 breaking command-surface change，但 canonical `moluoxixi` 保持兼容。
- root `main` push 先触发常规 CI；角色 package 发布由 `moluoxixi-v0.6.22` tag push 单独触发。
- 发布 workflow 在 tag checkout 上再次运行 frozen install、角色 verify/typecheck，再按 core→CLI 顺序发布。
- 认证与 provenance 由 GitHub Actions 的 `NPM_TOKEN` 和 OIDC 完成；本机不直接 `npm publish`。
- 没有 `gh` CLI 时仍可原生推送 tag，并通过已登录浏览器监控 Actions。

## 发布失败策略

- transient 网络故障：重跑同一 tag workflow；发布器会跳过已经存在的 package/version。
- repository secret/OIDC 配置故障：记录完整失败证据并交由用户修复外部配置；用户确认修复后再重跑同一 tag workflow，代理不自行修改 secret。
- tagged 内容需要修改：不移动或重建已推送 tag。若尚未发布也优先采用新 patch；若任一包已发布则必须升下一个 patch 并创建新 tag。
- 不以本地手工发布绕开 GitHub gate，不让 root/tag 内容与 npm provenance 脱节。

## 风险与回滚

- rebuild 当前 detached HEAD：编辑前创建本地维护分支；迁移单独 commit，可用 `git revert` 回滚。
- 导出器是破坏性完整替换：仅在 rebuild commit 和全 gate 通过后运行；失败时从回滚后的 rebuild commit 重新导出。
- lockfile 存在既有 identity 不一致：不做无关全量重写；若 frozen install 因此失败，记录为既有问题并使用已安装依赖和精确 package gates完成本任务验证。
- 禁止 `npm --force`、`--force-rebuild` 和 rebuild 内会 push 上游 remote 的 release 编排脚本。
