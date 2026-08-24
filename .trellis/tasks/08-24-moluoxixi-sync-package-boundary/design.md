# 技术设计

## 边界

本次调整把 moluoxixi 维护流程分成两个明确边界：

1. `roles/moluoxixi/.sync/` 负责固定上游、rebuild、完整导出以及导出后的 identity 检查。
2. tracked 仓库与 `roles/moluoxixi/packages/` 只保留用户安装、运行、测试和发布所需内容。

## 数据流

```text
.sync/trellis（只读固定上游）
  -> .sync/rebuild/packages（本地适配与提交）
  -> .sync/scripts/export-moluoxixi-upstream.mjs（完整替换）
  -> roles/moluoxixi/packages（真实产物）
  -> .sync/scripts/verify-moluoxixi-identity.mjs（同步后检查）
```

同步主脚本继续只在显式 `--export` 时替换真实产物。identity scanner 从根 `scripts/` 迁到 `.sync/scripts/` 后，由同步主脚本直接以 Node 执行；`--skip-identity` 仍作为维护者显式跳过本地 gate 的选项，不再依赖根 npm script。

## 公开契约

- AIRules 主 CLI 通过 `npm install --global moluoxixi-ai-rules` 安装；Moluoxixi 独立 CLI 通过 `npm install --global @moluoxixi/airules-moluoxixi-cli` 安装。
- 两个 CLI 都以各自的 `--version` 验证；角色安装/验证使用已安装的 `airules install/verify <role>` 命令。
- 根 `package.json` 不提供 moluoxixi identity verify script。
- `roles/moluoxixi/package.json` 的 `verify:publish` 保留真实发布所需 gates，但不包含同步 identity gate。

## 测试边界

- 删除依赖迁移前 tracked scanner 的 `identity-boundary.test.ts`，避免 fresh clone 的常规测试依赖 ignored `.sync`。
- 在现有 moluoxixi source/package 测试中增加公开 manifest 与产物无同步工具的否定断言。
- 直接运行 `.sync` scanner 验证本地同步后检查仍可用。
- 不把角色专属测试放入 `scripts/lib/__test__/`。

## 宿主 skills 投影

- canonical skills 始终安装到 `~/.agents/skills`。
- `codex`、`cursor`、`qoder`、`opencode` 使用现有 `projectSkills: false` 跳过 host 私有 skills 投影和对应验证。
- MCP 投影由独立配置控制，四个平台的 MCP 行为保持不变。
- 当 host 不再启用 skills 投影时，安装流程扫描原 host skills 目录，只删除可解析到 AIRules 内部资产的符号链接；普通文件、真实目录、外部链接和 host 目录本身保持原状。
- Qoder 的纳入来自用户确认；QoderWork 继续使用 `~/.qoderwork/skills`。

## 兼容与回滚

- 不改变 moluoxixi CLI bin、package 名称、运行时命令或发布版本。
- 如 scanner 迁移后路径解析失败，可恢复根脚本和两个 npm script 入口；完整导出器与 rebuild 不受影响。
- 不执行 `--force-rebuild`，不重置源码镜像或 rebuild worktree。
- 如某平台未来撤回 canonical skills 兼容，只需恢复该 host 的 `projectSkills` 默认值；MCP 无需回滚。
