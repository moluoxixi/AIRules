# Moluoxixi AIRules

AIRules 通过 `airules` CLI 分发 AI skills 与宿主配置。

角色清单随发行包提供；第一方资产在运行时从远程仓库按完整 role path 同步，不从安装包中的本地角色目录投影。公共模式默认不选择角色；通过 `--role <name>` 显式选择需要安装的角色。

## 安装

```bash
npm install
npm run build
npm link
```

## CLI

```bash
airules sync --host all
airules sync --host all --role <name>
airules verify --host all
airules --version
airules contract-diff --capabilities
airules contract-diff --expected <openapi.json|yaml> --actual <openapi.json|yaml> --output <audit.json>
```

`moluoxixi` 角色需要显式选择：

```bash
airules sync --host all --role moluoxixi
```

- 同步会以可回滚替换方式安装完整角色到 `~/.moluoxixi/roles/moluoxixi`，再把标准 skills、agents、hooks、rules 和 MCP 资产投影到对应宿主。
- `roles/moluoxixi` 包含 `mindfold-ai/Trellis` `v0.6.7` 提交 `e7c5ead4d0dfd717d11a40b6bc0c80d8af94c49a` 的精选角色资产：15 个可分发 skills，以及 Claude、Codex、Cursor、OMP、OpenCode、Pi 的原生 agents、commands、hooks、plugins、extensions 与 settings。仓库自动化、package workspace、实现源码、测试、demo、发布专用资产、备份与项目本地 `.trellis` 历史均有意省略。
- 标准 `.agents/skills`、`.claude/agents` 与根 `AGENTS.md` 会映射为角色的标准 skills、agents 与 rules；完整 role path 同时保留精选的多宿主原生适配。同步安装固定版本的 `@mindfoldhq/trellis@0.6.7` CLI；项目运行时文件由用户在项目内执行 `trellis init` 后生成，不把上游仓库自用设置直接覆盖到全局宿主。
- 角色运行时从 AIRules 远程仓库的 `roles/moluoxixi` 完整路径同步；精选 Trellis 角色资产不随 AIRules npm 包重复发布。当前分支合入远端默认分支后，该同步入口才可用。
- Trellis 保留上游 AGPL-3.0-only 许可证，不受本仓库 MIT 许可证覆盖。

- `sync` 更新所选远程资产、执行声明的固定版本 CLI setup，并投影到支持的宿主。
- `verify` 检查受管宿主投影。
- `contract-diff` 确定性比对固定版本的 OpenAPI 3.x JSON/YAML 快照。退出码 `0` 表示无阻断差异，`2` 会保留有效的阻断差异报告；输入无效或语义不受支持时返回 `1`，并在输出路径安全时写入结构化 error audit。无法完整比对的 OpenAPI 线协议语义必须失败关闭。文件输出采用锚定目录的 create-only 直接写入协议：既有 target 只有在仍是基线记录的同一 inode 且内容完全相同时才可幂等复用；基线中不存在的 target 以排他方式创建，任何并发出现（即使内容相同）都会失败。该协议不承诺 rename 式原子可见性。语义提交前，新文件以 `!` 开头并刻意保持为无效 JSON；进程崩溃可能留下该不完整文件，并发读取者也可能观察到它。只有在无效标记的完整 payload 写入并同步、受保护输入和 target inode 复核、首字节替换为 `{` 并再次同步、且路径仍指向所创建 inode 后才报告成功。消费者必须对 JSON 解析或 schema 校验失败关闭；遗留的无效 partial 文件必须由证据 owner 显式清理后再重试。
- `contract-diff --capabilities` 以机器可读 JSON 暴露 CLI 版本、审计报告版本与退出码契约，使远程同步角色能在分析前拒绝不兼容的可执行文件。
- `--skip-vendors` 仅在缓存 checkout 的 origin、工作树和固定 revision 校验通过后跳过更新；未固定的完整远程 role path 必须刷新，不能跳过。
- `--no-verify` 跳过同步后的宿主校验。

## 角色 Hook 清单

角色只通过 `roles/<role>/hooks/hooks.json` 声明需要分发的 hook；目录中存在脚本但没有清单时不会启用。脚本必须是同目录下的普通 `.mjs` 文件，事件名可按宿主覆盖：

```json
{
  "version": 1,
  "hooks": [
    {
      "event": "Stop",
      "script": "workflow-dispatcher.mjs",
      "support_files": ["workflow-hook-lib.mjs"],
      "hosts": ["claude", "codex", "cursor"],
      "event_by_host": { "cursor": "stop" }
    }
  ]
}
```

`support_files` 用于声明主脚本导入的同目录 `.mjs` 辅助模块；同步会复制并校验这些文件，但不会把它们注册成事件命令。同步会把清单转换成各宿主的 JSON/TOML 结构，收敛删除不再声明的 AIRules 受管条目，保留用户 hook，并在 `verify` 时校验脚本哈希与精确命令结构。

## 维护

```bash
npm run typecheck
npm run build
npm run lint:check
npm test
```

保留 `scripts/sync-vendors.ts` 与 `vendor-lock.json` 用于 vendor 锁维护。测试前不再自动执行 vendor 同步。

## 许可证

AIRules 公共代码采用 MIT 许可证。`roles/moluoxixi` 中包含的第三方 Trellis 资产采用上游 AGPL-3.0-only 许可证，详情见该目录内的 `LICENSE` 与 `COPYRIGHT`；AIRules 新增的角色适配文件仍采用本仓库许可证。
