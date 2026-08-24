# 实施计划

## 修改步骤

- [x] 将 `codex`、`cursor`、`qoder`、`opencode` 配置为复用 canonical skills，同时保持各自 MCP 配置。
- [x] 为禁用 host skills 投影的升级路径增加受限旧链接清理，不触碰用户自有内容。
- [x] 更新 install/verify 覆盖，验证四个平台跳过私有 skills、MCP 继续投影，其它 host 保持现状。
- [x] 完整改写 `README.md` 与 `README-zh.md` 的安装和用法，仅保留 package 路径。
- [x] 将根 `scripts/verify-moluoxixi-identity.mjs` 迁入 `roles/moluoxixi/.sync/scripts/`，修正默认 repo/role 路径。
- [x] 修改 `.sync/scripts/sync-moluoxixi-upstream.mjs`，直接调用迁入后的 scanner。
- [x] 从根 `package.json` 删除 `verify:moluoxixi-identity`。
- [x] 从 `roles/moluoxixi/package.json` 删除 `verify:identity`，并收紧 `verify:publish`。
- [x] 删除依赖旧 scanner 位置的角色测试，并在现有 source/package 测试中补充真实产物边界断言。
- [x] 更新 `.sync/README.md`，使维护命令和同步后检查全部指向 `.sync`。

## 验证命令

- [x] 运行 host 常量、安装投影和 verify 聚焦测试，覆盖 canonical skills 与旧链接清理。
- [x] 全仓检索 `npm link`、`verify:moluoxixi-identity`、`verify:identity`、`moluoxixi-identify` 和旧 scanner 路径。
- [x] 运行 `.sync` identity scanner，确认导出后的 source/package 边界通过。
- [x] 运行 moluoxixi 角色测试、类型检查和发布验证相关测试。
- [x] 运行仓库 lint/typecheck 中与修改文件相关的检查。
- [x] 检查 `.sync/trellis` 与 `.sync/rebuild` 均无本次意外改动，并检查 tracked git diff。

## 风险点

- scanner 迁移后默认路径需从 `.sync/scripts` 正确解析到仓库根与角色根。
- `.sync` 被 gitignore，tracked 测试不能依赖该文件在 fresh clone 中存在。
- README 双语和四处旧 `npm link` 必须同时清理，避免保留隐蔽旧入口。
- 不得把 identity gate 从发布链移除时误删 `verify-packed-cli` 等真实发布校验。
- 旧链接清理必须只删除 AIRules 管理的内部链接，不能把整个 host skills 目录当作可重建目录。
