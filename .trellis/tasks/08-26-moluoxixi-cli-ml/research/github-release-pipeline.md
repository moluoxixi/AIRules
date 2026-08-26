# Moluoxixi 0.6.22 GitHub 发布流水线

## 触发与边界

- `.github/workflows/publish-role-packages.yml:3` 监听 `*-v*.*.*` tag push，也支持输入已有 tag 的 `workflow_dispatch`。
- 本次发布 tag 为 `moluoxixi-v0.6.22`；仅推送该 tag 即可触发，不需要 GitHub Release 或 `gh` CLI。
- `.github/workflows/publish.yml` 只监听根包 `v*.*.*`，不会被角色 tag 命中；CI workflow 只监听 `main` push/PR，不监听 tag。
- 发布 tag 必须指向已经包含最终导出 `roles/moluoxixi/packages` 的 root commit。

## Workflow 顺序

`publish-role-packages.yml` 的发布 job：

1. checkout 指定 tag，并验证 HEAD 与 tag commit 一致；
2. 安装 pnpm `10.32.1`、Node `24` 和 frozen 根依赖；
3. 运行 `prepare-release --tag`，安装角色 workspace；
4. 运行通用角色配置校验、`verify:publish` 与 `typecheck`；
5. 调用 `scripts/role-packages.ts publish --tag`。

发布顺序由 `roles/moluoxixi/constants/skills.ts` 决定：先 core，后依赖 core 的 CLI。实际 publish 使用 `--no-git-checks --provenance --access public --tag latest`。

## 认证与成功条件

- workflow permissions：`contents: read`、`id-token: write`。
- npm 写认证：repository secret `NPM_TOKEN`；provenance 使用 GitHub OIDC。
- workflow 成功后还需只读验证：
  - `@moluoxixi/airules-moluoxixi-core@0.6.22` 可见；
  - `@moluoxixi/airules-moluoxixi-cli@0.6.22` 可见；
  - 两个 package 的 `latest` 均为 `0.6.22`；
  - published CLI manifest 的 bin 为 `moluoxixi` + `ml`，无 `tl`。

## 幂等与失败处理

- 发布器在 publish 前查询精确版本；已存在的 package/version 会跳过，因此 core 成功、CLI 失败后可以重跑同一 workflow。
- 发布后会校验 dist-tag，并在需要时修复 tag。
- 网络、鉴权、OIDC 或 secret 错误不会被当作“版本不存在”；应修复外部配置后重跑同一 tag workflow。
- tag 推送后视为不可变。一旦发布内容需要代码修复，尤其任一 package 已发布，不移动/删除 `moluoxixi-v0.6.22`，而是准备下一 patch 版本与新 tag。
- 禁止本地手工补发某个 package，避免绕开统一门禁与 provenance。

## 无 `gh` CLI 的监控路径

- tag 通过原生 `git push origin moluoxixi-v0.6.22` 触发。
- 使用已登录的浏览器查看 Actions run、日志和终态；失败时可从网页重跑 job。
- 如需要 workflow dispatch，可通过 GitHub Actions 网页输入已有 tag；不依赖 GitHub Release。
